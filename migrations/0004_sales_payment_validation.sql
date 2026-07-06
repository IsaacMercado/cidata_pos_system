-- ============================================================
-- POS System - Query and payment integrity improvements
-- Push more business rules into D1 and optimize hot lookups
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_sales_table_status ON sales(table_id, status);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_restaurant_active ON restaurant_tables(restaurant_id, is_active);

CREATE TRIGGER IF NOT EXISTS trg_sales_before_complete_require_exact_payment
BEFORE UPDATE OF status ON sales
WHEN NEW.status = 'completed'
  AND OLD.status != 'completed'
  AND EXISTS (SELECT 1 FROM sale_payments WHERE sale_id = NEW.id)
BEGIN
  SELECT CASE
    WHEN ABS((
      SELECT COALESCE(SUM(amount), 0)
      FROM sale_payments
      WHERE sale_id = NEW.id
    ) - NEW.total) > 0.01
    THEN RAISE(ABORT, 'PAYMENT_TOTAL_MISMATCH: El total de pagos debe coincidir con el total de la venta')
  END;
END;
