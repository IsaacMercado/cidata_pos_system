from odoo import fields, models


class PosPayment(models.Model):
    _inherit = "pos.payment"

    cf_currency = fields.Selection(
        [("USD", "USD"), ("VES", "VES")],
        string="Moneda original (Cloudflare)",
        help="Moneda en la que el cliente pagó realmente en el POS Cloudflare.",
    )
    cf_amount_original = fields.Float(
        string="Monto original (Cloudflare)",
        digits=(16, 2),
        help="Monto exacto pagado por el cliente en su moneda. Nunca se recalcula.",
    )
    cf_exchange_rate = fields.Float(
        string="Tasa aplicada",
        digits=(16, 6),
        help="Tasa USD/VES usada en la venta para obtener el equivalente contable.",
    )
    cf_phone = fields.Char(string="Teléfono (pago móvil)")
