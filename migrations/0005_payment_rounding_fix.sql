-- ============================================================
-- POS System - Payment rounding tolerance fix
-- Avoid float precision false positives in split payments
-- ============================================================

DROP TRIGGER IF EXISTS trg_sale_payments_after_complete;

CREATE TRIGGER IF NOT EXISTS trg_sale_payments_after_complete
AFTER INSERT ON sale_payments
BEGIN
  SELECT CASE
    WHEN ROUND((
      SELECT COALESCE(SUM(amount), 0)
      FROM sale_payments
      WHERE sale_id = NEW.sale_id
    ), 2) > ROUND((
      SELECT total
      FROM sales
      WHERE id = NEW.sale_id
    ), 2)
    THEN RAISE(ABORT, 'PAYMENT_EXCEEDS_TOTAL: El total de pagos supera el monto de la venta')
  END;
END;

DROP TRIGGER IF EXISTS trg_sales_before_complete_require_exact_payment;

CREATE TRIGGER IF NOT EXISTS trg_sales_before_complete_require_exact_payment
BEFORE UPDATE OF status ON sales
WHEN NEW.status = 'completed'
  AND OLD.status != 'completed'
  AND EXISTS (SELECT 1 FROM sale_payments WHERE sale_id = NEW.id)
BEGIN
  SELECT CASE
    WHEN ABS(
      ROUND((
        SELECT COALESCE(SUM(amount), 0)
        FROM sale_payments
        WHERE sale_id = NEW.id
      ), 2) - ROUND(NEW.total, 2)
    ) > 0.009
    THEN RAISE(ABORT, 'PAYMENT_TOTAL_MISMATCH: El total de pagos debe coincidir con el total de la venta')
  END;
END;
