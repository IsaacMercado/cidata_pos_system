{
    "name": "Cidata POS Cloudflare Sync",
    "summary": "Sincroniza ventas del POS Cloudflare hacia Odoo POS (cola saliente, sin exponer servidores locales).",
    "description": """
Módulo adaptador entre el POS Cloudflare y Odoo.

- Odoo consulta al Worker público (solicitudes salientes).
- Descarga operaciones pendientes (ventas) y las crea en pos.session / pos.order / pos.payment.
- Confirma o reporta errores al Worker mediante ack/fail idempotentes.
- Descarga cambios de catálogo publicados desde Odoo hacia el POS.
- Conserva monto original, moneda, tasa y referencias de pago móvil en la operación.
- No crea partners por venta: usa un partner genérico "Visitante ocasional".

Ver docs/PLAN_INTEGRACION_ODOO.md para el contrato completo.
""",
    "author": "Cidata",
    "website": "https://cidata.example",
    "category": "Sales/Point of Sale",
    "version": "19.0.2.0.0",
    "license": "LGPL-3",
    "depends": ["account", "point_of_sale", "stock", "mrp"],
    "data": [
        "security/ir.model.access.csv",
        "data/ir_cron.xml",
        "views/cloudflare_operation_views.xml",
        "views/cloudflare_payment_map_views.xml",
        "views/cloudflare_restaurant_views.xml",
        "views/cloudflare_sync_views.xml",
        "views/pos_payment_views.xml",
        "views/report_views.xml",
        "views/res_config_settings_views.xml",
    ],
    "installable": True,
    "application": True,
}
