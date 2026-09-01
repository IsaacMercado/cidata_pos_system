from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = "res.config.settings"

    cf_worker_url = fields.Char(
        string="URL del Worker Cloudflare",
        config_parameter="cidata_pos_sync.worker_url",
        help="URL base pública del Worker, por ejemplo https://pos.ejemplo.workers.dev",
    )
    cf_integration_token = fields.Char(
        string="Token de integración",
        config_parameter="cidata_pos_sync.integration_token",
        help="Token de servicio (INTEGRATION_TOKEN del Worker). Se envía como Bearer.",
    )
    cf_auto_open_session = fields.Boolean(
        string="Abrir sesión POS automáticamente",
        config_parameter="cidata_pos_sync.auto_open_session",
        default=True,
        help="Si no hay sesión abierta, abrirla automáticamente durante la sincronización.",
    )
    cf_pos_config_id = fields.Many2one(
        "pos.config",
        string="Configuración POS destino",
        config_parameter="cidata_pos_sync.pos_config_id",
        help="Sesiones de esta configuración recibirán las ventas. Vacío = la primera disponible.",
    )
