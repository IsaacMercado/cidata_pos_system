import json

from odoo.api import model

from odoo import fields, models


class CloudflareOperation(models.Model):
    _name = "cloudflare.operation"
    _description = "Operación de integración Cloudflare POS"
    _order = "id desc"
    _rec_name = "operation_id"

    operation_id = fields.Char(
        string="ID de operación",
        required=True,
        index=True,
        copy=False,
        help="Identificador único de la operación en la cola del Worker.",
    )
    installation_id = fields.Char(string="Instalación")
    entity_type = fields.Selection(
        [
            ("sale", "Venta"),
            ("sale_cancel", "Cancelación de venta"),
        ],
        string="Tipo",
        required=True,
    )
    entity_id = fields.Char(
        string="Entidad",
        help="client_id o receipt_number de la venta.",
    )
    payload = fields.Text(string="Payload original", readonly=True)
    state = fields.Selection(
        [
            ("pending", "Pendiente"),
            ("processing", "Procesando"),
            ("done", "Aceptada"),
            ("error_retry", "Error (reintento)"),
            ("rejected", "Rechazada (funcional)"),
            ("dead_letter", "Dead letter"),
        ],
        default="pending",
        required=True,
        index=True,
    )
    attempts = fields.Integer(string="Intentos")
    last_error = fields.Text(string="Último error")
    processed_at = fields.Datetime(string="Procesada")
    pos_order_id = fields.Many2one(
        "pos.order",
        string="Orden POS",
        readonly=True,
    )
    company_id = fields.Many2one(
        "res.company",
        default=lambda self: self.env.company,
        required=True,
    )

    _operation_id_company_unique = models.Constraint(
        "unique(operation_id, company_id)",
        "La operación ya fue registrada para esta compañía.",
    )

    @model
    def upsert_from_worker(self, operation: dict):
        """Crea o actualiza el espejo local de una operación del Worker."""
        existing = self.search(
            [
                ("operation_id", "=", operation["operation_id"]),
                ("company_id", "=", self.env.company.id),
            ],
            limit=1,
        )
        entity_type = operation.get("entity_type") or "sale"
        if entity_type not in ("sale", "sale_cancel"):
            # Tolerancia a variantes del Worker (p.ej. "cancel").
            entity_type = "sale_cancel" if "cancel" in str(entity_type) else "sale"
        vals = {
            "operation_id": operation["operation_id"],
            "installation_id": operation.get("installation_id"),
            "entity_type": entity_type,
            "entity_id": str(operation.get("entity_id") or ""),
            "payload": json.dumps(
                operation.get("payload"),
                ensure_ascii=False,
                indent=2,
                sort_keys=True,
            ),
            "attempts": operation.get("attempt_count") or 0,
        }
        if existing:
            existing.write(vals)
            return existing
        return self.create({**vals, "company_id": self.env.company.id})
