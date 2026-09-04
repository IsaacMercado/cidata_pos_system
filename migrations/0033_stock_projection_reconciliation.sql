-- Fase 4: keep Odoo's official stock separate from the POS projection.
ALTER TABLE products ADD COLUMN stock_official REAL;

-- Existing operational writes still target current_stock. Keep the new
-- projection column synchronized until all callers use the new name.
UPDATE products SET stock_projection = current_stock;

DROP TRIGGER IF EXISTS trg_products_projection_compat;
CREATE TRIGGER trg_products_projection_compat
AFTER UPDATE OF current_stock ON products
WHEN NEW.current_stock != OLD.current_stock
BEGIN
  UPDATE products SET stock_projection = NEW.current_stock WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS stock_reconciliations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  stock_official REAL NOT NULL,
  stock_projection REAL NOT NULL,
  difference REAL NOT NULL,
  observed_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'odoo',
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stock_reconciliations_product_observed
  ON stock_reconciliations(product_id, observed_at DESC);
