import logging

import requests
from odoo.exceptions import UserError
from odoo.fields import Command
from odoo.tools import float_compare

from odoo import _, api, fields, models

_logger = logging.getLogger(__name__)

PARAM_PREFIX = "cidata_pos_sync"
ANON_PARTNER_REF = "visitante_ocasional"
HTTP_TIMEOUT = 30


class CloudflareFunctionalError(UserError):
    """Error funcional: la operación no puede procesarse con los datos actuales.

    Se reporta al Worker como 'functional': queda detenida y visible,
    sin consumir reintentos ni descartarse.
    """


class CloudflarePermanentError(UserError):
    """Error permanente: datos inválidos o duplicados incompatibles (dead_letter)."""


class PosOrderCloudflareIdentity(models.Model):
    _inherit = "pos.order"

    _cloudflare_uuid_company_unique = models.Constraint(
        "unique(uuid, company_id)",
        "La orden POS ya existe para este identificador Cloudflare en la compañía.",
    )


class CloudflareSync(models.TransientModel):
    _name = "cloudflare.sync"
    _description = "Panel de sincronización Cloudflare POS"

    stats_pending = fields.Integer(compute="_compute_stats")
    stats_done = fields.Integer(compute="_compute_stats")
    stats_error = fields.Integer(compute="_compute_stats")
    stats_dead_letter = fields.Integer(compute="_compute_stats")
    last_sync_text = fields.Char(compute="_compute_stats")

    @api.depends_context("company")
    def _compute_stats(self):
        Operation = self.env["cloudflare.operation"]
        domain_base = [("company_id", "=", self.env.company.id)]

        for rec in self:
            rec.stats_pending = Operation.search_count(domain_base + [("state", "in", ["pending", "processing", "error_retry"])])
            rec.stats_done = Operation.search_count(domain_base + [("state", "=", "done")])
            rec.stats_error = Operation.search_count(domain_base + [("state", "=", "rejected")])
            rec.stats_dead_letter = Operation.search_count(domain_base + [("state", "=", "dead_letter")])

            param = self.env["ir.config_parameter"].sudo().get_param(f"{PARAM_PREFIX}.last_sync_at")
            rec.last_sync_text = param or _("Nunca")

    # ──────────────────────────────────────────────────────────────────────
    # Configuración y HTTP
    # ──────────────────────────────────────────────────────────────────────

    def _get_param(self, key, required=True, default=None):
        value = self.env["ir.config_parameter"].sudo().get_param(f"{PARAM_PREFIX}.{key}", default)
        if required and not value:
            raise UserError(
                _("Falta configurar '%(key)s' en Ajustes > Cloudflare POS Sync.", key=key)
            )
        return value

    def _worker_request(self, method, path, **kwargs):
        url = self._get_param("worker_url").rstrip("/") + path
        token = self._get_param("integration_token")
        headers = {"Authorization": f"Bearer {token}"}
        try:
            response = requests.request(
                method, url, headers=headers, timeout=HTTP_TIMEOUT, **kwargs
            )
        except requests.RequestException as exc:
            # Error técnico/red: reintento. Las operaciones quedan como están.
            raise UserError(_("Error de red contra el Worker: %s", exc)) from exc
        if response.status_code >= 400:
            detail = response.text[:500]
            raise UserError(
                _("El Worker respondió %(code)s en %(path)s: %(detail)s",
                  code=response.status_code, path=path, detail=detail)
            )
        return response.json() if response.content else {}

    # ──────────────────────────────────────────────────────────────────────
    # Acciones del panel
    # ──────────────────────────────────────────────────────────────────────

    def action_test_connection(self):
        self._worker_request("POST", "/api/integration/auth")
        return self._notify(_("Conexión exitosa con el Worker."))

    def action_push_stock(self):
        """Fase 7: publica el inventario oficial (Odoo) hacia el POS.

        Solo productos simples estocables; el stock de los combos es una
        proyección de sus componentes y no se publica.
    """

        warehouse = self.env["stock.warehouse"].search(
            [("company_id", "=", self.env.company.id)], limit=1
        )
        location = warehouse.lot_stock_id if warehouse else False
        if not location:
            raise UserError(_("No existe un almacén para la compañía actual."))
        changes = []
        products = self.env["product.product"].search(
            [("default_code", "!=", False), ("is_storable", "=", True)]
        )
        for product in products:
            has_bom = self.env["mrp.bom"].search_count([
                ("product_tmpl_id", "=", product.product_tmpl_id.id),
                ("type", "=", "phantom"),
            ])
            if has_bom:
                continue
            quants = self.env["stock.quant"].search(
                [
                    ("product_id", "=", product.id),
                    ("location_id", "child_of", location.id),
                ]
            )
            available = sum(quants.mapped("available_quantity"))
            changes.append({
                "change_id": f"cf_stock_{warehouse.id}_{product.default_code}",
                "entity_type": "product",
                "action": "upsert",
                "external_ref": product.default_code,
                "data": {"current_stock": available},
            })
        if not changes:
            return self._notify(_("Sin productos estocables que publicar."))
        # El contrato acepta lotes; se envían en bloques razonables.
        for start in range(0, len(changes), 200):
            self._worker_request(
                "POST", "/api/integration/catalog/publish",
                json={"changes": changes[start:start + 200]},
            )
        return self._notify(_("Stock publicado al POS: %d productos.", len(changes)))

    def _catalog_product_change(self, product):
        """Build the administrative product representation sent to Cloudflare.

        Odoo product variants are published as individual POS products. This
        preserves each variant SKU, price, barcode and stock without making
        Odoo depend on the POS local database.
        """
        values = getattr(product, "product_template_attribute_value_ids", False)
        variant_values = {}
        variant_attributes = []
        for value in values or []:
            attribute = getattr(value, "attribute_id", False)
            attribute_value = getattr(value, "product_attribute_value_id", False)
            if attribute and attribute_value:
                variant_attributes.append(attribute.name)
                variant_values[attribute.name] = attribute_value.name

        tax = product.taxes_id.filtered(
            lambda item: item.type_tax_use == "sale" and item.company_id == self.env.company
        )[:1]
        return {
            "name": product.display_name,
            "price": float(product.lst_price),
            "cost": float(product.standard_price),
            "barcode": product.barcode or None,
            "description": product.description_sale or None,
            "tax_rate_percent": float(tax.amount) if tax and tax.amount_type == "percent" else 0,
            "unit": product.uom_id.name or "unit",
            "product_type": "simple",
            "catalog_status": "active" if product.sale_ok and product.available_in_pos else "inactive",
            "is_active": bool(product.sale_ok and product.available_in_pos),
            "variant_attributes": variant_attributes,
            "variant_values": variant_values,
        }

    def action_publish_catalog(self):
        """Publish Odoo POS products and their variants to Cloudflare."""
        products = self.env["product.product"].search([
            ("default_code", "!=", False),
            ("available_in_pos", "=", True),
        ])
        changes = [
            {
                "change_id": f"cf_catalog_{self.env.company.id}_{product.default_code}",
                "entity_type": "product",
                "action": "upsert" if product.sale_ok else "deactivate",
                "external_ref": product.default_code,
                "data": self._catalog_product_change(product),
            }
            for product in products
        ]
        if not changes:
            return self._notify(_("No hay productos POS con SKU para publicar."), warning=True)
        for start in range(0, len(changes), 25):
            self._worker_request(
                "POST", "/api/integration/catalog/publish",
                json={"changes": changes[start:start + 25]},
            )
        return self._notify(_("Catálogo publicado al POS: %d productos/variantes.", len(changes)))

    def action_pull_catalog(self):
        data = self._worker_request("GET", "/api/integration/catalog/changes")
        created_products = updated_products = created_categories = 0
        combo_failures = []
        for category in data.get("categories", []):
            if self._upsert_category(category):
                created_categories += 1
        # Primero productos simples para que existan los componentes,
        # después combos que los referencian.
        simple = [p for p in data.get("products", []) if p.get("product_type") != "combo"]
        combos = [p for p in data.get("products", []) if p.get("product_type") == "combo"]
        for product in simple + combos:
            created, updated = self._upsert_product(product)
            created_products += int(created)
            updated_products += int(updated)
            if product.get("product_type") == "combo" and product.get("combo_items"):
                try:
                    product_record = self.env["product.product"].search(
                        [("default_code", "=", product.get("external_id"))], limit=1
                    )
                    self._sync_combo_bom(product_record, product)
                except CloudflareFunctionalError as exc:
                    combo_failures.append(str(exc))
        self._ensure_payment_maps(data.get("payment_methods", []))
        # Fase 8: restaurantes, mesas y tarifas.
        self._sync_restaurants(data.get("restaurants", []), data.get("tables", []))
        self._sync_reservation_rates(data.get("reservation_rates", []))
        message = _(
            "Catálogo: %(cats)d categorías nuevas, %(new)d productos creados, %(upd)d actualizados.",
            cats=created_categories, new=created_products, upd=updated_products,
        )
        if combo_failures:
            message += "\n" + _("Combos con error: %s", "; ".join(combo_failures))
        return self._notify(message, warning=bool(combo_failures))

    def action_sync_operations(self):
        batch = self._worker_request(
            "GET", "/api/integration/operations/pending?limit=25"
        )
        operations = batch.get("operations", [])
        acks, fails = [], []
        for operation in operations:
            mirror = self.env["cloudflare.operation"].upsert_from_worker(operation)
            try:
                # Savepoint: un fallo de BD en una operación no debe abortar
                # la transacción completa del lote.
                with self.env.cr.savepoint():
                    refs = self._process_operation(operation)
                # Solo referencias públicas para el Worker.
                public_refs = {
                    key: value
                    for key, value in (refs or {}).items()
                    if not key.startswith("_") and value is not None
                }
                acks.append({
                    "operation_id": operation["operation_id"],
                    "lease_token": operation["lease_token"],
                    "odoo_refs": public_refs,
                })
                mirror.write({
                    "state": "done",
                    "processed_at": fields.Datetime.now(),
                    "last_error": False,
                    "pos_order_id": refs.get("_pos_order_id"),
                })
            except (CloudflareFunctionalError, CloudflarePermanentError) as exc:
                classification = (
                    "permanent"
                    if isinstance(exc, CloudflarePermanentError)
                    else "functional"
                )
                fails.append({
                    "operation_id": operation["operation_id"],
                    "lease_token": operation["lease_token"],
                    "error": str(exc),
                    "classification": classification,
                })
                mirror.write({
                    "state": "dead_letter" if classification == "permanent" else "rejected",
                    "last_error": str(exc),
                    "processed_at": fields.Datetime.now(),
                })
            except Exception as exc:  # error no clasificado: reintento
                _logger.exception("Error procesando operación %s", operation["operation_id"])
                message = str(exc)[:2000]
                fails.append({
                    "operation_id": operation["operation_id"],
                    "error": message,
                    "classification": "retryable",
                })
                mirror.write({"state": "error_retry", "last_error": message})

        if acks:
            self._worker_request("POST", "/api/integration/operations/ack", json={"results": acks})
        if fails:
            self._worker_request("POST", "/api/integration/operations/fail", json={"results": fails})

        self.env["ir.config_parameter"].sudo().set_param(
            f"{PARAM_PREFIX}.last_sync_at", fields.Datetime.now()
        )

        if not operations:
            return self._notify(_("Sin operaciones pendientes."))
        return self._notify(
            _("Sincronizadas: %(ok)d aceptadas, %(fail)d con error.", ok=len(acks), fail=len(fails))
        )

    def cron_sync(self):
        """Cron: intenta sincronizar; los errores técnicos solo se registran."""
        for company in self.env["res.company"].search([]):
            sync = self.with_company(company)
            try:
                sync.action_sync_operations()
            except UserError as exc:
                _logger.warning("Cron Cloudflare Sync (%s): %s", company.name, exc)

    # ──────────────────────────────────────────────────────────────────────
    # Procesamiento por tipo de entidad
    # ──────────────────────────────────────────────────────────────────────

    def _process_operation(self, operation):
        entity_type = str(operation.get("entity_type") or "sale")
        payload = operation.get("payload") or {}
        # Tolerancia a variantes del Worker (p.ej. "cancel" vs "sale_cancel").
        if entity_type not in ("sale", "sale_cancel"):
            entity_type = "sale_cancel" if "cancel" in entity_type else "sale"
        if entity_type == "sale":
            order = self._process_sale(payload)
            return {
                "pos_order_name": order.name,
                "pos_order_uuid": order.uuid or "",
                "_pos_order_id": order.id,
            }
        if entity_type == "sale_cancel":
            self._process_cancel(payload)
            return {"_pos_order_id": None}
        raise CloudflareFunctionalError(_("Tipo de entidad desconocido: %s", entity_type))

    def _process_cancel(self, payload):
        """Fase 8 (adelantada): cancelación como reembolso POS nativo.

        Crea una orden de reembolso en la sesión actual usando el flujo
        nativo de Odoo (_refund), con pago negativo y estado pagado.
        Queda auditada y vinculada a la venta original.
        """
        identity = payload.get("client_id") or payload.get("receipt_number")
        order = self.env["pos.order"].search(
            [("uuid", "=", identity), ("company_id", "=", self.env.company.id)],
            limit=1,
        )
        if not order:
            # La venta puede llegar más tarde en otro lote: reintentable.
            raise UserError(
                _("Cancelación diferida: la venta %s aún no llegó a Odoo.", identity)
            )

        refund_uuid = f"{identity}-refund"
        existing_refund = self.env["pos.order"].search(
            [("uuid", "=", refund_uuid), ("company_id", "=", self.env.company.id)],
            limit=1,
        )
        if existing_refund:
            return existing_refund  # idempotencia

        if order.state not in ("paid", "done"):
            raise CloudflareFunctionalError(
                _("Cancelación: la venta %s no está pagada en Odoo (estado %s).",
                  identity, order.state)
            )

        config = order.session_id.config_id
        self._ensure_open_session(config)

        with self.env.cr.savepoint():
            refund_order = order._refund()

        total = refund_order.amount_total
        if not refund_order.lines or float_compare(total, 0.0, precision_rounding=refund_order.currency_id.rounding) >= 0:
            raise CloudflareFunctionalError(
                _("Cancelación de %s: no se generaron líneas de reembolso.", order.name)
            )

        # Conserva la distribución original del pago dividido.
        payment_method = False
        original_payments = order.payment_ids.filtered(lambda payment: payment.amount)
        if not original_payments:
            payment_method = self._resolve_default_refund_method(config)
        if not payment_method:
            if not original_payments:
                raise CloudflareFunctionalError(
                    _("Cancelación de %s: sin método de pago para devolver.", order.name)
                )
        if original_payments:
            original_total = sum(original_payments.mapped("amount"))
            allocated = 0.0
            for index, original_payment in enumerate(original_payments):
                amount = total - allocated if index == len(original_payments) - 1 else (
                    total * original_payment.amount / original_total
                )
                allocated += amount
                refund_order.add_payment({
                    "pos_order_id": refund_order.id,
                    "payment_method_id": original_payment.payment_method_id.id,
                    "amount": amount,
                    "payment_date": payload.get("cancelled_at") or fields.Datetime.now(),
                })
        else:
            refund_order.add_payment({
                "pos_order_id": refund_order.id,
                "payment_method_id": payment_method.id,
                "amount": total,
                "payment_date": payload.get("cancelled_at") or fields.Datetime.now(),
            })
        refund_order.write({"uuid": refund_uuid})
        try:
            refund_order.action_pos_order_paid()
            refund_order._create_order_picking()  # devolución de stock
        except UserError as exc:
            raise CloudflareFunctionalError(
                _("Reembolso de %s rechazado por Odoo: %s", order.name, exc)
            ) from exc
        return refund_order

    def _resolve_default_refund_method(self, config):
        method = self.env["pos.payment.method"].search(
            [("is_cash_count", "=", True)], limit=1
        )
        return method

    def _process_sale(self, payload):
        sale = payload.get("sale") or {}
        identity = sale.get("client_id") or sale.get("receipt_number")
        if not identity:
            raise CloudflarePermanentError(_("Venta sin identificador (client_id)."))

        existing = self.env["pos.order"].search(
            [("uuid", "=", identity), ("company_id", "=", self.env.company.id)],
            limit=1,
        )
        if existing:
            return existing  # idempotencia: ya sincronizada

        # Prepara métodos de pago antes de abrir sesión (Odoo los bloquea
        # con sesiones abiertas).
        payments = payload.get("payments") or []
        config = self._ensure_pos_config()
        for payment in payments:
            self._resolve_payment_method(payment.get("method_code"), config)

        session = self._ensure_open_session(config)
        partner = self._ensure_anonymous_partner()

        line_commands = []
        for index, item in enumerate(payload.get("items") or []):
            product = self._resolve_product(item.get("code"))
            taxes = product.taxes_id.filtered(
                lambda t: t.company_id == config.company_id and t.amount_type != "fixed"
            )
            line_commands.append(
                Command.create({
                    "product_id": product.id,
                    "qty": float(item.get("quantity") or 1),
                    "price_unit": float(item.get("unit_price") or 0),
                    "discount": float(item.get("discount_percent") or 0),
                    "tax_ids": [Command.set(taxes.ids)],
                    "uuid": f"{identity}-{index}",
                    # Montos iniciales: se recalculan con _compute_amount_line_all().
                    "price_subtotal": 0.0,
                    "price_subtotal_incl": 0.0,
                })
            )
        if not line_commands:
            raise CloudflareFunctionalError(_("Venta sin líneas: %s", identity))

        date_order = sale.get("created_at") or fields.Datetime.now()
        order = self.env["pos.order"].create({
            "session_id": session.id,
            "partner_id": partner.id,
            "uuid": identity,
            "date_order": date_order,
            "lines": line_commands,
            "to_invoice": False,
            # Los montos reales los calcula Odoo en _compute_prices().
            "amount_paid": 0.0,
            "amount_return": 0.0,
            "amount_tax": 0.0,
            "amount_total": 0.0,
        })

        for line in order.lines:
            line.write(line._compute_amount_line_all())

        for payment in payments:
            payment_method = self._resolve_payment_method(payment.get("method_code"), config)
            amount = payment.get("amount_usd") or payment.get("amount") or 0
            vals = {
                "pos_order_id": order.id,
                "payment_method_id": payment_method.id,
                "amount": float(amount),
                # Fase 6: datos originales del pago, inmutables.
                "cf_currency": payment.get("currency") or "USD",
                "cf_amount_original": float(payment.get("amount_original") or amount),
                "cf_exchange_rate": float(payment.get("exchange_rate") or 0),
                "cf_phone": payment.get("phone") or False,
            }
            if payment.get("reference"):
                vals["payment_ref_no"] = payment["reference"]
            if payment.get("payment_date"):
                vals["payment_date"] = payment["payment_date"]
            order.add_payment(vals)

        order._compute_prices()

        remote_total = sale.get("total")
        if remote_total is not None:
            difference = abs(float(remote_total) - order.amount_total)
            rounding = order.currency_id.rounding or 0.01
            if round(difference, 4) > rounding / 2:
                raise CloudflareFunctionalError(
                    _("Diferencia de totales en venta %(identity)s: POS %(remote)s vs Odoo %(local)s",
                      identity=identity, remote=remote_total, local=order.amount_total)
                )

        try:
            order.action_pos_order_paid()
            # El flujo nativo (_process_saved_order) crea el picking; como
            # sincronizamos por API hay que generarlo explícitamente para
            # que el inventario oficial descunte (Fase 7).
            order._create_order_picking()
            # Fase 8: crear reservas vinculadas a la venta.
            self._create_reservations_from_payload(payload, order)
        except UserError as exc:
            raise CloudflareFunctionalError(
                _("Venta %(identity)s rechazada por Odoo: %(exc)s", identity=identity, exc=exc)
            ) from exc

        note = (
            _("POS Cloudflare · recibo %(receipt)s · tasa USD/VES %(rate)s · pagos originales: %(orig)s",
              receipt=sale.get("receipt_number") or "",
              rate=", ".join(
                  str(p.get("exchange_rate")) for p in payload.get("payments") or [] if p.get("exchange_rate")
              ) or "-",
              orig=", ".join(
                  "%s %s" % (p.get("amount_original"), p.get("currency"))
                  for p in payload.get("payments") or []
              ))
        )
        order.message_post(body=note)
        return order

    # ──────────────────────────────────────────────────────────────────────
    # Resolución de registros maestros
    # ──────────────────────────────────────────────────────────────────────

    def _ensure_pos_config(self):
        PosConfig = self.env["pos.config"]
        config_id_param = self._get_param("pos_config_id", required=False)
        if config_id_param:
            config = PosConfig.browse(int(config_id_param))
            if config.exists():
                return config
        config = PosConfig.search([("company_id", "=", self.env.company.id)], limit=1)
        if not config:
            raise CloudflareFunctionalError(_("No existe ninguna configuración POS."))
        return config

    def _ensure_open_session(self, config):
        Session = self.env["pos.session"]
        session = Session.search(
            [
                ("state", "=", "opened"),
                ("config_id", "=", config.id),
            ],
            limit=1,
        )
        if session:
            return session
        auto_open = (self._get_param("auto_open_session", required=False, default="True") or "").lower() in ("true", "1")
        if not auto_open:
            raise CloudflareFunctionalError(
                _("No hay sesión abierta para %(config)s y la apertura automática está desactivada.",
                  config=config.name)
            )
        # Reutiliza una sesión en control de apertura pendiente antes de crear otra.
        pending = Session.search(
            [
                ("state", "=", "opening_control"),
                ("config_id", "=", config.id),
            ],
            limit=1,
        )
        if not pending:
            pending = Session.create({
                "config_id": config.id,
                "user_id": self.env.user.id,
            })
        pending.set_opening_control(0, False)
        return pending

    def _ensure_anonymous_partner(self):
        Partner = self.env["res.partner"].with_company(self.env.company)
        partner = Partner.search([("ref", "=", ANON_PARTNER_REF)], limit=1)
        if partner:
            return partner
        return Partner.create({
            "name": _("Visitante ocasional"),
            "ref": ANON_PARTNER_REF,
            "company_type": "person",
        })

    def _resolve_product(self, code):
        Product = self.env["product.product"]
        if not code:
            raise CloudflareFunctionalError(_("Línea de venta sin código de producto."))
        product = Product.search([("default_code", "=", code)], limit=1)
        if not product:
            product = Product.search([("barcode", "=", code)], limit=1)
        if not product:
            raise CloudflareFunctionalError(_("Producto no encontrado en Odoo: %s", code))
        return product

    def _resolve_payment_method(self, cloudflare_code, config=None):
        if not cloudflare_code:
            raise CloudflareFunctionalError(_("Pago sin método de pago."))
        mapping = self.env["cloudflare.payment.map"].search(
            [("cloudflare_code", "=", cloudflare_code)],
            limit=1,
        )
        if not mapping or not mapping.payment_method_id:
            raise CloudflareFunctionalError(
                _("Método de pago sin mapear a Odoo: %s", cloudflare_code)
            )
        self._prepare_payment_method(mapping.payment_method_id, config)
        return mapping.payment_method_id

    def _prepare_payment_method(self, payment_method, config=None):
        """Garantiza diario y disponibilidad en la configuración POS.

        Debe ejecutarse ANTES de abrir sesiones: Odoo prohíbe modificar
        métodos de pago con sesiones abiertas.
        """
        config = config or self._ensure_pos_config()
        if payment_method.open_session_ids:
            # Ya se usa en sesiones abiertas: su diario existe.
            return
        try:
            if not payment_method.journal_id:
                Journal = self.env["account.journal"]
                journal = Journal.search(
                    [
                        ("name", "=", payment_method.name),
                        ("type", "=", "bank"),
                        ("company_id", "=", config.company_id.id),
                    ],
                    limit=1,
                )
                if not journal:
                    journal = Journal.create({
                        "name": payment_method.name or _("POS Cloudflare"),
                        "code": f"P{payment_method.id}"[:5],
                        "type": "bank",
                        "company_id": config.company_id.id,
                    })
                payment_method.journal_id = journal.id
            if payment_method not in config.payment_method_ids:
                config.write({"payment_method_ids": [Command.link(payment_method.id)]})
        except UserError as exc:
            raise CloudflareFunctionalError(
                _("Habilita manualmente el método de pago '%(name)s' en el POS %(config)s "
                  "(o cierra la sesión abierta) y reintenta: %(exc)s",
                  name=payment_method.name, config=config.name, exc=exc)
            ) from exc

    def _map_category(self, cloudflare_id):
        data = self.env["ir.model.data"].sudo().search(
            [
                ("module", "=", PARAM_PREFIX),
                ("name", "=", f"cf_category_{cloudflare_id}"),
            ],
            limit=1,
        )
        return self.env["product.category"].browse(data.res_id) if data else self.env["product.category"]

    def _upsert_category(self, category):
        Category = self.env["product.category"]
        cf_id = category.get("cloudflare_id")
        existing = self._map_category(cf_id)
        vals = {"name": category.get("name")}
        parent_cf = category.get("parent_cloudflare_id")
        if parent_cf:
            parent = self._map_category(parent_cf)
            if parent:
                vals["parent_id"] = parent.id
        if existing:
            existing.write(vals)
            return False
        new_category = Category.create(vals)
        self.env["ir.model.data"].sudo().create({
            "module": PARAM_PREFIX,
            "name": f"cf_category_{cf_id}",
            "model": "product.category",
            "res_id": new_category.id,
            "noupdate": True,
        })
        return True

    def _sync_combo_bom(self, product, product_data):
        """Fase 7: combo Cloudflare -> LTM fantasma en Odoo.

        El combo consume sus componentes: al cerrar la sesión, los
        stock.move de Odoo explotan el LTM phantom y el inventario oficial
        descuenta componentes, igual que la proyección del POS.
        """
        items = product_data.get("combo_items") or []
        template = product.product_tmpl_id
        if not items or not template:
            return
        template.write({"is_storable": True})
        Bom = self.env["mrp.bom"]
        bom = Bom.search(
            [
                ("product_tmpl_id", "=", template.id),
                ("type", "=", "phantom"),
            ],
            limit=1,
        )
        line_commands = [Command.clear()]
        for item in items:
            component_code = item.get("component_external_id")
            component = self.env["product.product"].search(
                [("default_code", "=", component_code)], limit=1
            )
            if not component:
                raise CloudflareFunctionalError(
                    _("Componente de combo no encontrado en Odoo: %s", component_code)
                )
            line_commands.append(Command.create({
                "product_id": component.id,
                "product_qty": float(item.get("quantity") or 1),
            }))
        vals = {"type": "phantom", "bom_line_ids": line_commands}
        if bom:
            bom.write(vals)
        else:
            Bom.create({**vals, "product_tmpl_id": template.id})

    def _upsert_product(self, product_data):
        Product = self.env["product.product"]
        external_id = product_data.get("external_id")
        if not external_id:
            return False, False
        vals = {
            "name": product_data.get("name") or external_id,
            "default_code": external_id,
            "list_price": float(product_data.get("price") or 0),
            "sale_ok": bool(product_data.get("is_active", True)),
            "available_in_pos": bool(product_data.get("is_active", True)),
            # Fase 7: Odoo es el inventario oficial; todo producto del POS
            # es estocable para que las ventas descuenten existencias.
            "is_storable": True,
        }
        if product_data.get("barcode"):
            vals["barcode"] = product_data["barcode"]
        if product_data.get("description"):
            vals["description_sale"] = product_data["description"]
        category = self._map_category(product_data.get("category_cloudflare_id"))
        if category:
            vals["categ_id"] = category.id

        # Fase 4: impuestos. La tasa viene del POS (tax_rate_percent).
        # 0% => producto sin impuesto de venta. >0% => buscar account.tax
        # con ese porcentaje; si no existe, queda el impuesto por defecto y la
        # validación de totales lo hará visible al sincronizar ventas.
        tax_rate = float(product_data.get("tax_rate_percent") or 0)
        company_taxes = self.env["account.tax"].search(
            [
                ("type_tax_use", "=", "sale"),
                ("amount_type", "=", "percent"),
                ("company_id", "=", self.env.company.id),
            ]
        )
        if tax_rate == 0:
            vals["taxes_id"] = [Command.clear()]
        else:
            matching = company_taxes.filtered(lambda t: float_compare(t.amount, tax_rate, precision_digits=4) == 0)
            if matching:
                vals["taxes_id"] = [Command.set(matching.ids)]

        existing = Product.search([("default_code", "=", external_id)], limit=1)
        if existing:
            existing.write(vals)
            return False, True
        Product.create(vals)
        return True, False

    def _ensure_payment_maps(self, payment_methods):
        PaymentMap = self.env["cloudflare.payment.map"]
        for method in payment_methods:
            exists = PaymentMap.search(
                [("cloudflare_code", "=", method.get("code"))], limit=1
            )
            if not exists:
                PaymentMap.create({
                    "cloudflare_code": method.get("code"),
                    "cloudflare_name": method.get("name"),
                })

    def _sync_restaurants(self, restaurant_data, table_data):
        Restaurant = self.env["cloudflare.restaurant"]
        Restaurant.sync_from_worker(restaurant_data)
        restaurant_map = {
            r.cf_id: r for r in Restaurant.search([("company_id", "=", self.env.company.id)])
        }
        self.env["cloudflare.table"].sync_from_worker(table_data, restaurant_map)

    def _sync_reservation_rates(self, rate_data):
        product_map = {
            p.default_code: p
            for p in self.env["product.product"].search([("default_code", "!=", False)])
        }
        self.env["cloudflare.reservation.rate"].sync_from_worker(rate_data, product_map)

    def _create_reservations_from_payload(self, payload, order):
        reservations_data = payload.get("reservations") or []
        if reservations_data:
            self.env["cloudflare.reservation"].sync_from_payload(reservations_data, order)

    def _notify(self, message, warning=False):
        return {
            "type": "ir.actions.client",
            "tag": "display_notification",
            "params": {
                "title": _("Cloudflare POS Sync"),
                "message": message,
                "type": "warning" if warning else "success",
                "sticky": False,
            },
        }
