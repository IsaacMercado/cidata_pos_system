from odoo import fields, models, tools


class CidataPaymentReport(models.Model):
    _name = "cidata.payment.report"
    _description = "Reporte de pagos Cloudflare"
    _auto = False
    _rec_name = "receipt_number"
    _order = "payment_date desc, id desc"

    id = fields.Id(readonly=True)
    payment_date = fields.Datetime(string="Fecha", readonly=True)
    receipt_number = fields.Char(string="Recibo", readonly=True)
    order_id = fields.Many2one(
        "pos.order",
        string="Orden",
        readonly=True,
    )
    payment_method_id = fields.Many2one(
        "pos.payment.method",
        string="Método",
        readonly=True,
    )
    journal_id = fields.Many2one(
        "account.journal",
        string="Diario",
        readonly=True,
    )
    amount = fields.Float(string="Monto contable", readonly=True)
    currency = fields.Char(string="Moneda original", readonly=True)
    amount_original = fields.Float(string="Monto original", readonly=True)
    exchange_rate = fields.Float(string="Tasa USD/VES", readonly=True)
    reference = fields.Char(string="Referencia registrada", readonly=True)
    reference_status = fields.Selection(
        [
            ("none", "Sin referencia"),
            ("partial", "Referencia parcial"),
            ("provided", "Referencia registrada"),
        ],
        string="Estado referencia",
        readonly=True,
    )
    phone = fields.Char(string="Teléfono", readonly=True)
    reconciled = fields.Boolean(string="Conciliado", readonly=True)
    reconciliation_status = fields.Selection(
        [
            ("reconciled", "Conciliado"),
            ("unreconciled", "No conciliado"),
        ],
        string="Estado conciliación",
        readonly=True,
    )
    company_id = fields.Many2one("res.company", readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW cidata_payment_report AS (
                SELECT
                    pp.id,
                    COALESCE(pp.payment_date, po.date_order) AS payment_date,
                    po.name AS receipt_number,
                    po.id AS order_id,
                    pp.payment_method_id,
                    aj.id AS journal_id,
                    pp.amount,
                    pp.cf_currency AS currency,
                    pp.cf_amount_original AS amount_original,
                    pp.cf_exchange_rate AS exchange_rate,
                    pp.payment_ref_no AS reference,
                    CASE
                        WHEN pp.payment_ref_no IS NULL OR pp.payment_ref_no = '' THEN 'none'
                        WHEN pp.payment_ref_no ~ '^[0-9]{4}$' THEN 'partial'
                        ELSE 'provided'
                    END AS reference_status,
                    pp.cf_phone AS phone,
                    EXISTS (
                        SELECT 1
                        FROM account_move_line rec_aml
                        JOIN account_account rec_account ON rec_account.id = rec_aml.account_id
                        WHERE rec_aml.move_id = am.id
                          AND rec_account.reconcile
                          AND rec_aml.reconciled
                    ) AS reconciled,
                    CASE WHEN EXISTS (
                        SELECT 1
                        FROM account_move_line rec_aml
                        JOIN account_account rec_account ON rec_account.id = rec_aml.account_id
                        WHERE rec_aml.move_id = am.id
                          AND rec_account.reconcile
                          AND rec_aml.reconciled
                    )
                         THEN 'reconciled' ELSE 'unreconciled' END AS reconciliation_status,
                    po.company_id
                FROM pos_payment pp
                JOIN pos_order po ON po.id = pp.pos_order_id
                LEFT JOIN pos_payment_method ppm ON ppm.id = pp.payment_method_id
                LEFT JOIN account_journal aj ON aj.id = ppm.journal_id
                LEFT JOIN account_move am ON am.id = pp.account_move_id
            )
        """)


class CidataSaleCategoryReport(models.Model):
    _name = "cidata.sale.category.report"
    _description = "Ventas por categoria Cloudflare"
    _auto = False
    _rec_name = "product_name"
    _order = "date_order desc, id desc"

    id = fields.Id(readonly=True)
    date_order = fields.Datetime(string="Fecha", readonly=True)
    order_id = fields.Many2one("pos.order", string="Orden", readonly=True)
    receipt_number = fields.Char(string="Recibo", readonly=True)
    product_id = fields.Many2one("product.product", string="Producto", readonly=True)
    product_name = fields.Char(string="Producto", readonly=True)
    category_id = fields.Many2one("product.category", string="Categoria", readonly=True)
    category_name = fields.Char(string="Categoria", readonly=True)
    quantity = fields.Float(string="Cantidad", readonly=True)
    subtotal = fields.Float(string="Subtotal", readonly=True)
    total = fields.Float(string="Total", readonly=True)
    company_id = fields.Many2one("res.company", readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW cidata_sale_category_report AS (
                SELECT
                    pol.id,
                    po.date_order,
                    po.id AS order_id,
                    po.name AS receipt_number,
                    pol.product_id,
                    pt.name->>'en_US' AS product_name,
                    pc.id AS category_id,
                    pc.name AS category_name,
                    pol.qty AS quantity,
                    pol.price_subtotal AS subtotal,
                    pol.price_subtotal_incl AS total,
                    po.company_id
                FROM pos_order_line pol
                JOIN pos_order po ON po.id = pol.order_id
                JOIN product_product pp ON pp.id = pol.product_id
                JOIN product_template pt ON pt.id = pp.product_tmpl_id
                LEFT JOIN product_category pc ON pc.id = pt.categ_id
            )
        """)
