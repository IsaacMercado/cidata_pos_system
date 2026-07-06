-- ============================================================
-- POS System - Sale Payments (split payment support)
-- Allows multiple payment methods per sale (e.g., card + cash)
-- ============================================================

CREATE TABLE IF NOT EXISTS sale_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  payment_method_id INTEGER REFERENCES payment_methods(id),
  amount REAL NOT NULL CHECK (amount > 0),
  reference TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON sale_payments(sale_id);

-- Validate payments total equals sale total before completing
CREATE TRIGGER IF NOT EXISTS trg_sale_payments_after_complete
AFTER INSERT ON sale_payments
BEGIN
  SELECT CASE
    WHEN (
      SELECT COALESCE(SUM(amount), 0) FROM sale_payments WHERE sale_id = NEW.sale_id
    ) > (
      SELECT total FROM sales WHERE id = NEW.sale_id
    ) THEN RAISE(ABORT, 'PAYMENT_EXCEEDS_TOTAL: El total de pagos supera el monto de la venta')
  END;
END;

-- Seed payment methods if not exist
INSERT OR IGNORE INTO payment_methods (id, code, name) VALUES (1, 'cash', 'Efectivo');
INSERT OR IGNORE INTO payment_methods (id, code, name) VALUES (2, 'card', 'Tarjeta');
INSERT OR IGNORE INTO payment_methods (id, code, name) VALUES (3, 'transfer', 'Transferencia');
INSERT OR IGNORE INTO payment_methods (id, code, name) VALUES (4, 'credit', 'Crédito');
