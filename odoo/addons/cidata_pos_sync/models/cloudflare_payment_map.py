from odoo import fields, models


class CloudflarePaymentMap(models.Model):
    _name = "cloudflare.payment.map"
    _description = "Mapeo de métodos de pago Cloudflare -> Odoo"
    _order = "cloudflare_code"
    _rec_name = "cloudflare_name"
    cloudflare_code = fields.Char(string="Código en el POS", required=True)
    cloudflare_name = fields.Char(string="Nombre en el POS")
    payment_method_id = fields.Many2one(
        "pos.payment.method",
        string="Método de pago en Odoo",
        ondelete="set null",
        help="Método de pago de Odoo que recibirá los pagos con este código.",
    )
    company_id = fields.Many2one(
        "res.company",
        default=lambda self: self.env.company,
        required=True,
    )

    _code_company_unique = models.Constraint(
        "unique(cloudflare_code, company_id)",
        "Ya existe un mapeo para ese código de pago.",
    )
