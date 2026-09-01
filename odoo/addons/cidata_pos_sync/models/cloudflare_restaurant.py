from odoo import api, fields, models


class CloudflareRestaurant(models.Model):
    _name = "cloudflare.restaurant"
    _description = "Restaurante del POS Cloudflare"
    _rec_name = "name"

    _cf_id_unique = models.Constraint(
        "unique(cf_id, company_id)", "ID Cloudflare duplicado."
    )

    cf_id = fields.Integer(string="ID Cloudflare", index=True, required=True)
    name = fields.Char(string="Nombre", required=True)
    is_active = fields.Boolean(string="Activo", default=True)
    table_ids = fields.One2many("cloudflare.table", "restaurant_id", string="Mesas")
    company_id = fields.Many2one(
        "res.company", string="Compañía", required=True,
        default=lambda self: self.env.company,
    )

    @api.model
    def sync_from_worker(self, restaurant_data):
        for data in restaurant_data:
            cf_id = data.get("cloudflare_id")
            if not cf_id:
                continue
            existing = self.search(
                [("cf_id", "=", cf_id), ("company_id", "=", self.env.company.id)],
                limit=1,
            )
            vals = {
                "name": data.get("name") or f"Restaurante {cf_id}",
                "is_active": bool(data.get("is_active", True)),
            }
            if existing:
                existing.write(vals)
            else:
                self.create({**vals, "cf_id": cf_id})


class CloudflareTable(models.Model):
    _name = "cloudflare.table"
    _description = "Mesa del POS Cloudflare"
    _rec_name = "name"

    _cf_id_unique = models.Constraint(
        "unique(cf_id, company_id)", "ID Cloudflare duplicado."
    )

    cf_id = fields.Integer(string="ID Cloudflare", index=True, required=True)
    restaurant_id = fields.Many2one(
        "cloudflare.restaurant", string="Restaurante", required=True, ondelete="cascade",
    )
    name = fields.Char(string="Nombre", required=True)
    capacity = fields.Integer(string="Capacidad", default=2)
    status = fields.Selection(
        [
            ("available", "Disponible"),
            ("occupied", "Ocupada"),
            ("reserved", "Reservada"),
            ("inactive", "Inactiva"),
        ],
        string="Estado",
        default="available",
    )
    is_active = fields.Boolean(string="Activa", default=True)
    company_id = fields.Many2one(
        "res.company", string="Compañía", required=True,
        default=lambda self: self.env.company,
    )

    @api.model
    def sync_from_worker(self, table_data, restaurant_map):
        for data in table_data:
            cf_id = data.get("cloudflare_id")
            if not cf_id:
                continue
            rest_cf_id = data.get("restaurant_cloudflare_id")
            restaurant = restaurant_map.get(rest_cf_id)
            if not restaurant:
                continue
            existing = self.search(
                [("cf_id", "=", cf_id), ("company_id", "=", self.env.company.id)],
                limit=1,
            )
            vals = {
                "restaurant_id": restaurant.id,
                "name": data.get("name") or f"Mesa {cf_id}",
                "capacity": data.get("capacity") or 2,
                "status": data.get("status") or "available",
                "is_active": bool(data.get("is_active", True)),
            }
            if existing:
                existing.write(vals)
            else:
                self.create({**vals, "cf_id": cf_id})


class CloudflareReservationRate(models.Model):
    _name = "cloudflare.reservation.rate"
    _description = "Tarifa de reserva por huéspedes"
    _rec_name = "product_id"

    _product_guests_unique = models.Constraint(
        "unique(product_id, guests, company_id)",
        "Ya existe una tarifa para este producto y cantidad de huéspedes.",
    )

    product_id = fields.Many2one(
        "product.product", string="Producto", required=True, ondelete="cascade",
    )
    guests = fields.Integer(string="Huéspedes", required=True, default=1)
    price = fields.Float(string="Precio", required=True, default=0)
    company_id = fields.Many2one(
        "res.company", string="Compañía", required=True,
        default=lambda self: self.env.company,
    )

    @api.model
    def sync_from_worker(self, rate_data, product_map):
        for data in rate_data:
            product_code = data.get("product_code")
            product = product_map.get(product_code)
            if not product:
                continue
            guests = data.get("guests") or 1
            existing = self.search(
                [
                    ("product_id", "=", product.id),
                    ("guests", "=", guests),
                    ("company_id", "=", self.env.company.id),
                ],
                limit=1,
            )
            vals = {
                "price": float(data.get("price") or 0),
            }
            if existing:
                existing.write(vals)
            else:
                self.create({
                    **vals,
                    "product_id": product.id,
                    "guests": guests,
                })


class CloudflareReservation(models.Model):
    _name = "cloudflare.reservation"
    _description = "Reserva temporal del POS"
    _rec_name = "product_id"

    _cf_id_unique = models.Constraint(
        "unique(cf_id, company_id)", "ID Cloudflare duplicado."
    )

    cf_id = fields.Char(string="ID Cloudflare", index=True, required=True)
    product_id = fields.Many2one(
        "product.product", string="Producto (habitación)", required=True,
    )
    pos_order_id = fields.Many2one(
        "pos.order", string="Orden POS", readonly=True,
    )
    guest_name = fields.Char(string="Nombre del huésped")
    check_in = fields.Date(string="Fecha de entrada", required=True)
    check_out = fields.Date(string="Fecha de salida", required=True)
    nights = fields.Integer(string="Noches", compute="_compute_nights", store=True)
    guests = fields.Integer(string="Huéspedes", default=1)
    guest_price = fields.Float(string="Precio por huésped")
    total = fields.Float(string="Total")
    state = fields.Selection(
        [
            ("pending", "Pendiente"),
            ("confirmed", "Confirmada"),
            ("checked_in", "Check-in"),
            ("checked_out", "Check-out"),
            ("cancelled", "Cancelada"),
        ],
        string="Estado",
        default="pending",
    )
    company_id = fields.Many2one(
        "res.company", string="Compañía", required=True,
        default=lambda self: self.env.company,
    )

    @api.depends("check_in", "check_out")
    def _compute_nights(self):
        for rec in self:
            if rec.check_in and rec.check_out:
                rec.nights = (rec.check_out - rec.check_in).days or 1
            else:
                rec.nights = 0

    @api.model
    def sync_from_payload(self, reservation_data, order=None):
        """Crea o actualiza reserva desde payload del Worker."""
        for data in reservation_data:
            cf_id = str(data.get("reservation_id") or data.get("id") or (
                f"legacy_{data.get('client_id', '')}_{data.get('product_code', '')}_"
                f"{data.get('check_in', '')}_{data.get('check_out', '')}"
            ))
            existing = self.search(
                [("cf_id", "=", cf_id), ("company_id", "=", self.env.company.id)],
                limit=1,
            )
            product = self.env["product.product"].search(
                [("default_code", "=", data.get("product_code"))], limit=1
            )
            vals = {
                "product_id": product.id if product else False,
                "pos_order_id": order.id if order else False,
                "guest_name": data.get("client_id"),
                "check_in": data.get("check_in"),
                "check_out": data.get("check_out"),
                "guests": data.get("guests") or 1,
                "guest_price": float(data.get("guest_price") or 0),
                "total": float(data.get("total") or 0),
                "state": "confirmed" if order and order.state == "paid" else "pending",
            }
            if existing:
                existing.write(vals)
            else:
                self.create({**vals, "cf_id": cf_id})

    def action_confirm(self):
        self.ensure_one()
        if self.state != "pending":
            return False
        self.write({"state": "confirmed"})
        return True

    def action_checkin(self):
        self.ensure_one()
        if self.state != "confirmed":
            return False
        self.write({"state": "checked_in"})
        return True

    def action_checkout(self):
        self.ensure_one()
        if self.state != "checked_in":
            return False
        self.write({"state": "checked_out"})
        return True
