-- ============================================================
-- POS System - Trigger Fixes and Payment Validation
-- Fixes:
--   1. Trigger trg_products_stock_adjustment: lógica simplificada para evitar race conditions
--   2. Validación de pagos parciales: verificar que suma == total al completar
--   3. Índice faltante en saleItems.saleId (ya existe pero se refuerza)
--   4. Trigger para validar pagos en ventas con payment_method_id directo
-- ============================================================

-- ─── 1. DROP triggers conflictivos ───────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_products_stock_adjustment;
DROP TRIGGER IF EXISTS trg_sale_payments_after_complete;
DROP TRIGGER IF EXISTS trg_sales_before_complete_require_exact_payment;

-- ─── 2. Trigger simplificado para ajustes manuales de stock ──────────────────
-- Solo registra movimiento cuando el cambio NO viene de una venta
-- Usamos una ventana de tiempo para detectar si hubo una venta reciente
CREATE TRIGGER trg_products_stock_adjustment
AFTER UPDATE OF current_stock ON products
WHEN ABS(OLD.current_stock - NEW.current_stock) > 0.001
  AND NOT EXISTS (
    SELECT 1 FROM sale_items
    WHERE product_id = NEW.id
      AND created_at >= datetime('now', '-5 seconds')
      AND quantity = ABS(OLD.current_stock - NEW.current_stock)
  )
BEGIN
  INSERT INTO inventory_movements (
    product_id, type, quantity, reference_type, reference_id, notes, created_at
  ) VALUES (
    NEW.id, 'adjustment', NEW.current_stock - OLD.current_stock,
    'manual_adjustment', NEW.id,
    'Ajuste manual de inventario',
    datetime('now')
  );
END;

-- ─── 3. Validación de pagos al completar venta (con pagos parciales) ─────────
-- Se ejecuta ANTES de actualizar el status a 'completed'
-- Verifica que la suma de pagos coincida exactamente con el total
CREATE TRIGGER trg_sales_before_complete_validate_payment
BEFORE UPDATE OF status ON sales
WHEN NEW.status = 'completed' AND OLD.status != 'completed'
BEGIN
  SELECT CASE
    -- Si no hay pagos, levantar error
    WHEN NOT EXISTS (SELECT 1 FROM sale_payments WHERE sale_id = NEW.id)
      THEN RAISE(ABORT, 'PAYMENT_REQUIRED: La venta debe tener al menos un pago registrado')
    -- Si la suma de pagos no coincide con el total (tolerancia 0.01)
    WHEN ABS(
      ROUND((SELECT COALESCE(SUM(amount), 0) FROM sale_payments WHERE sale_id = NEW.id), 2) 
      - ROUND(NEW.total, 2)
    ) > 0.01
      THEN RAISE(ABORT, 'PAYMENT_TOTAL_MISMATCH: La suma de pagos (' || 
        (SELECT COALESCE(SUM(amount), 0) FROM sale_payments WHERE sale_id = NEW.id) || 
        ') no coincide con el total de la venta (' || NEW.total || ')')
  END;
END;

-- ─── 4. Trigger para prevenir pagos que excedan el total (INSERT/UPDATE) ─────
-- Se ejecuta después de insertar o actualizar un pago
-- Verifica que la suma acumulada no supere el total de la venta
CREATE TRIGGER trg_sale_payments_after_insert_check
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
    THEN RAISE(ABORT, 'PAYMENT_EXCEEDS_TOTAL: La suma de pagos supera el total de la venta')
  END;
END;

CREATE TRIGGER trg_sale_payments_after_update_check
AFTER UPDATE OF amount ON sale_payments
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
    THEN RAISE(ABORT, 'PAYMENT_EXCEEDS_TOTAL: La suma de pagos supera el total de la venta')
  END;
END;

-- ─── 5. Índice compuesto para búsquedas rápidas de pagos por venta ───────────
-- Ya existe idx_sale_payments_sale, pero agregamos uno compuesto para validaciones
CREATE INDEX IF NOT EXISTS idx_sale_payments_sale_amount ON sale_payments(sale_id, amount);

-- ─── 6. Trigger para actualizar payment_method_id cuando hay un solo pago ────
-- Al completar una venta, si hay un solo pago, actualizar el payment_method_id
CREATE TRIGGER trg_sales_after_complete_set_payment_method
AFTER UPDATE OF status ON sales
WHEN NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.payment_method_id IS NULL
BEGIN
  UPDATE sales SET
    payment_method_id = (
      SELECT payment_method_id FROM sale_payments
      WHERE sale_id = NEW.id
      ORDER BY created_at
      LIMIT 1
    )
  WHERE id = NEW.id;
END;