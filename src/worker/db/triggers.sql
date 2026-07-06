-- ============================================================
-- TRIGGERS - POS Business Logic
-- All business logic lives in the database via SQLite triggers
-- ============================================================

-- ─── 1. Stock validation before adding sale items ────────────────────────────
CREATE TRIGGER IF NOT EXISTS trg_sale_items_before_insert
BEFORE INSERT ON sale_items
BEGIN
  SELECT CASE
    WHEN (SELECT current_stock FROM products WHERE id = NEW.product_id) < NEW.quantity
    THEN RAISE(ABORT, 'STOCK_INSUFFICIENT: No hay suficiente inventario disponible')
  END;
END;

-- ─── 2. Auto-calculate sale totals and decrement stock ──────────────────────
CREATE TRIGGER IF NOT EXISTS trg_sale_items_after_insert
AFTER INSERT ON sale_items
BEGIN
  UPDATE sales SET
    subtotal = (
      SELECT COALESCE(SUM(subtotal), 0)
      FROM sale_items WHERE sale_id = NEW.sale_id
    ),
    tax_total = (
      SELECT COALESCE(SUM(tax_amount), 0)
      FROM sale_items WHERE sale_id = NEW.sale_id
    ),
    discount_total = (
      SELECT COALESCE(SUM(discount_amount), 0)
      FROM sale_items WHERE sale_id = NEW.sale_id
    ),
    total = (
      SELECT COALESCE(SUM(total), 0)
      FROM sale_items WHERE sale_id = NEW.sale_id
    ),
    updated_at = datetime('now')
  WHERE id = NEW.sale_id;

  UPDATE products SET
    current_stock = current_stock - NEW.quantity,
    updated_at = datetime('now')
  WHERE id = NEW.product_id;

  INSERT INTO inventory_movements (
    product_id, type, quantity, reference_type, reference_id, notes, created_at
  ) VALUES (
    NEW.product_id, 'exit', -NEW.quantity, 'sale', NEW.sale_id,
    'Venta #' || (SELECT receipt_number FROM sales WHERE id = NEW.sale_id),
    datetime('now')
  );

  INSERT INTO low_stock_alerts (product_id, current_stock, min_stock, created_at)
  SELECT id, current_stock, min_stock, datetime('now')
  FROM products
  WHERE id = NEW.product_id
    AND current_stock <= min_stock
    AND min_stock > 0
    AND id NOT IN (
      SELECT product_id FROM low_stock_alerts
      WHERE product_id = NEW.product_id AND resolved = 0
    );
END;

-- ─── 3. Restore totals and stock when items removed ─────────────────────────
CREATE TRIGGER IF NOT EXISTS trg_sale_items_after_delete
AFTER DELETE ON sale_items
BEGIN
  UPDATE sales SET
    subtotal = (
      SELECT COALESCE(SUM(subtotal), 0)
      FROM sale_items WHERE sale_id = OLD.sale_id
    ),
    tax_total = (
      SELECT COALESCE(SUM(tax_amount), 0)
      FROM sale_items WHERE sale_id = OLD.sale_id
    ),
    discount_total = (
      SELECT COALESCE(SUM(discount_amount), 0)
      FROM sale_items WHERE sale_id = OLD.sale_id
    ),
    total = (
      SELECT COALESCE(SUM(total), 0)
      FROM sale_items WHERE sale_id = OLD.sale_id
    ),
    updated_at = datetime('now')
  WHERE id = OLD.sale_id;

  UPDATE products SET
    current_stock = current_stock + OLD.quantity,
    updated_at = datetime('now')
  WHERE id = OLD.product_id;
END;

-- ─── 4. Restore stock when sale is cancelled ────────────────────────────────
CREATE TRIGGER IF NOT EXISTS trg_sales_after_cancel
AFTER UPDATE OF status ON sales
WHEN NEW.status = 'cancelled' AND OLD.status != 'cancelled'
BEGIN
  UPDATE products SET
    current_stock = current_stock + (
      SELECT COALESCE(SUM(quantity), 0)
      FROM sale_items
      WHERE sale_id = NEW.id AND product_id = products.id
    ),
    updated_at = datetime('now')
  WHERE id IN (SELECT DISTINCT product_id FROM sale_items WHERE sale_id = NEW.id);

  INSERT INTO inventory_movements (
    product_id, type, quantity, reference_type, reference_id, notes, created_at
  )
  SELECT
    product_id, 'entry', quantity, 'sale_cancelled', NEW.id,
    'Stock devuelto por cancelación de venta #' || NEW.receipt_number,
    datetime('now')
  FROM sale_items WHERE sale_id = NEW.id;
END;

-- ─── 5. Auto-update timestamps ──────────────────────────────────────────────
CREATE TRIGGER IF NOT EXISTS trg_products_after_update
AFTER UPDATE ON products
WHEN OLD.updated_at IS NOT NULL
BEGIN
  UPDATE products SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_customers_after_update
AFTER UPDATE ON customers
WHEN OLD.updated_at IS NOT NULL
BEGIN
  UPDATE customers SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_sales_after_update
AFTER UPDATE ON sales
WHEN OLD.updated_at IS NOT NULL
BEGIN
  UPDATE sales SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_users_after_update
AFTER UPDATE ON users
WHEN OLD.updated_at IS NOT NULL
BEGIN
  UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ─── 6. Log product stock adjustments ───────────────────────────────────────
CREATE TRIGGER IF NOT EXISTS trg_products_stock_adjustment
AFTER UPDATE OF current_stock ON products
WHEN OLD.current_stock != NEW.current_stock
  AND NEW.current_stock != OLD.current_stock - (
    SELECT COALESCE(SUM(quantity), 0)
    FROM sale_items WHERE product_id = NEW.id
    AND created_at > OLD.updated_at
  )
  AND NEW.current_stock != OLD.current_stock + OLD.current_stock
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
