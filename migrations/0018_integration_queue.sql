-- ============================================================
-- Fase 2: cola de integración POS Cloudflare -> Odoo
-- Contrato en docs/PLAN_INTEGRACION_ODOO.md (secciones 11-13)
-- ============================================================

CREATE TABLE integration_operations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_id TEXT NOT NULL UNIQUE,
  installation_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  error_class TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  processing_started_at TEXT,
  processed_at TEXT
);

CREATE INDEX idx_integration_operations_status ON integration_operations (status, created_at);
CREATE INDEX idx_integration_operations_entity ON integration_operations (entity_type, entity_id);

-- Bitácora de cambios de catálogo publicados desde Odoo (Fase 4)
CREATE TABLE catalog_change_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  change_id TEXT NOT NULL UNIQUE,
  entity_type TEXT NOT NULL,
  entity_ref TEXT NOT NULL,
  action TEXT NOT NULL,
  payload TEXT NOT NULL,
  applied_at TEXT,
  result TEXT,
  published_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Fase 1/7: conservar el monto original y la tasa exacta de cada pago.
-- 'amount' y 'amount_usd' siguen siendo el equivalente USD usado por la caja;
-- el monto original en su moneda nunca se sobrescribe.
ALTER TABLE sale_payments ADD COLUMN amount_original REAL;
ALTER TABLE sale_payments ADD COLUMN exchange_rate REAL;
