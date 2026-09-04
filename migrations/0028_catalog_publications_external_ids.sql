-- Fase 1: publicaciones completas y referencias estables de Odoo.
ALTER TABLE products ADD COLUMN template_external_id TEXT;
ALTER TABLE products ADD COLUMN variant_external_id TEXT;
ALTER TABLE products ADD COLUMN attribute_values TEXT NOT NULL DEFAULT '{}';
ALTER TABLE products ADD COLUMN tax_external_id TEXT;
ALTER TABLE products ADD COLUMN stock_projection REAL NOT NULL DEFAULT 0;

UPDATE products SET stock_projection = current_stock WHERE stock_projection = 0;

CREATE TABLE IF NOT EXISTS catalog_publications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT NOT NULL UNIQUE,
  company_external_id TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  published_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_catalog_publications_status
  ON catalog_publications(status, published_at);
