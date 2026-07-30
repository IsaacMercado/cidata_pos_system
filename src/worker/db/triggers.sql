-- ============================================================
-- TRIGGERS - POS Business Logic
-- ============================================================

DROP TRIGGER IF EXISTS trg_sale_items_before_insert;

CREATE TRIGGER IF NOT EXISTS trg_sale_items_before_insert
BEFORE INSERT ON sale_items
BEGIN
  SELECT CASE
    WHEN (
      SELECT product_type FROM products WHERE id = NEW.product_id
    ) = 'combo' AND EXISTS (
      SELECT 1 FROM combo_items ci
      JOIN products p ON p.id = ci.component_product_id
      WHERE ci.combo_product_id = NEW.product_id
        AND p.current_stock < ci.quantity * NEW.quantity
    )
    THEN RAISE(ABORT, 'STOCK_INSUFFICIENT: Componente de combo sin inventario disponible')
  END;

  SELECT CASE
    WHEN (
      SELECT product_type FROM products WHERE id = NEW.product_id
    ) IN ('simple', 'reservation')
      AND (SELECT current_stock FROM products WHERE id = NEW.product_id) < NEW.quantity
    THEN RAISE(ABORT, 'STOCK_INSUFFICIENT: No hay suficiente inventario disponible')
  END;
END;

DROP TRIGGER IF EXISTS trg_sale_items_after_insert;

CREATE TRIGGER IF NOT EXISTS trg_sale_items_after_insert
AFTER INSERT ON sale_items
BEGIN
  UPDATE sales SET
    subtotal = (SELECT COALESCE(SUM(subtotal), 0) FROM sale_items WHERE sale_id = NEW.sale_id),
    tax_total = (SELECT COALESCE(SUM(tax_amount), 0) FROM sale_items WHERE sale_id = NEW.sale_id),
    discount_total = (SELECT COALESCE(SUM(discount_amount), 0) FROM sale_items WHERE sale_id = NEW.sale_id),
    total = (SELECT COALESCE(SUM(total), 0) FROM sale_items WHERE sale_id = NEW.sale_id),
    updated_at = datetime('now')
  WHERE id = NEW.sale_id;

  UPDATE products SET
    current_stock = current_stock - (NEW.quantity * ci_qty.component_qty),
    updated_at = datetime('now')
  FROM (
    SELECT combo_product_id, component_product_id, quantity AS component_qty
    FROM combo_items WHERE combo_product_id = NEW.product_id
  ) AS ci_qty
  WHERE products.id = ci_qty.component_product_id
    AND (SELECT product_type FROM products WHERE id = NEW.product_id) = 'combo';

  UPDATE products SET
    current_stock = current_stock - NEW.quantity,
    updated_at = datetime('now')
  WHERE id = NEW.product_id
    AND (SELECT product_type FROM products WHERE id = NEW.product_id) != 'combo';

  INSERT INTO inventory_movements (product_id, type, quantity, reference_type, reference_id, notes, created_at)
  SELECT ci.component_product_id, 'exit', -(ci.quantity * NEW.quantity), 'sale', NEW.sale_id,
    'Venta combo #' || (SELECT receipt_number FROM sales WHERE id = NEW.sale_id)
      || ' - ' || (SELECT name FROM products WHERE id = NEW.product_id),
    datetime('now')
  FROM combo_items ci
  WHERE ci.combo_product_id = NEW.product_id
    AND (SELECT product_type FROM products WHERE id = NEW.product_id) = 'combo';

  INSERT INTO inventory_movements (product_id, type, quantity, reference_type, reference_id, notes, created_at)
  VALUES (NEW.product_id, 'exit', -NEW.quantity, 'sale', NEW.sale_id,
    'Venta #' || (SELECT receipt_number FROM sales WHERE id = NEW.sale_id), datetime('now'));

  INSERT INTO low_stock_alerts (product_id, current_stock, min_stock, created_at)
  SELECT
    CASE WHEN (SELECT product_type FROM products WHERE id = NEW.product_id) = 'combo'
      THEN ci.component_product_id ELSE NEW.product_id END,
    p.current_stock, p.min_stock, datetime('now')
  FROM products p
  LEFT JOIN combo_items ci ON ci.combo_product_id = NEW.product_id
  WHERE p.id IN (
    SELECT CASE WHEN (SELECT product_type FROM products WHERE id = NEW.product_id) = 'combo'
      THEN ci.component_product_id ELSE NEW.product_id END
  )
    AND p.current_stock <= p.min_stock AND p.min_stock > 0
    AND p.id NOT IN (SELECT product_id FROM low_stock_alerts WHERE product_id = p.id AND resolved = 0);
END;

DROP TRIGGER IF EXISTS trg_sale_items_after_delete;

CREATE TRIGGER IF NOT EXISTS trg_sale_items_after_delete
AFTER DELETE ON sale_items
BEGIN
  UPDATE sales SET
    subtotal = (SELECT COALESCE(SUM(subtotal), 0) FROM sale_items WHERE sale_id = OLD.sale_id),
    tax_total = (SELECT COALESCE(SUM(tax_amount), 0) FROM sale_items WHERE sale_id = OLD.sale_id),
    discount_total = (SELECT COALESCE(SUM(discount_amount), 0) FROM sale_items WHERE sale_id = OLD.sale_id),
    total = (SELECT COALESCE(SUM(total), 0) FROM sale_items WHERE sale_id = OLD.sale_id),
    updated_at = datetime('now')
  WHERE id = OLD.sale_id;

  UPDATE products SET
    current_stock = current_stock + OLD.quantity * ci.component_qty,
    updated_at = datetime('now')
  FROM (SELECT combo_product_id, component_product_id, quantity AS component_qty FROM combo_items WHERE combo_product_id = OLD.product_id) AS ci
  WHERE products.id = ci.component_product_id;

  UPDATE products SET
    current_stock = current_stock + OLD.quantity,
    updated_at = datetime('now')
  WHERE id = OLD.product_id
    AND (SELECT product_type FROM products WHERE id = OLD.product_id) != 'combo';
END;

DROP TRIGGER IF EXISTS trg_sales_after_cancel;

CREATE TRIGGER IF NOT EXISTS trg_sales_after_cancel
AFTER UPDATE OF status ON sales
WHEN NEW.status = 'cancelled' AND OLD.status != 'cancelled'
BEGIN
  UPDATE products SET
    current_stock = current_stock + (SELECT COALESCE(SUM(si.quantity * ci.quantity), 0)
      FROM sale_items si JOIN combo_items ci ON ci.combo_product_id = si.product_id
      WHERE si.sale_id = NEW.id AND ci.component_product_id = products.id),
    updated_at = datetime('now')
  WHERE id IN (SELECT ci.component_product_id FROM sale_items si
    JOIN combo_items ci ON ci.combo_product_id = si.product_id WHERE si.sale_id = NEW.id);

  UPDATE products SET
    current_stock = current_stock + (SELECT COALESCE(SUM(si.quantity), 0)
      FROM sale_items si WHERE si.sale_id = NEW.id AND si.product_id = products.id),
    updated_at = datetime('now')
  WHERE id IN (SELECT si.product_id FROM sale_items si
    WHERE si.sale_id = NEW.id
    AND (SELECT product_type FROM products WHERE si.product_id = products.id) != 'combo');

  INSERT INTO inventory_movements (product_id, type, quantity, reference_type, reference_id, notes, created_at)
  SELECT DISTINCT COALESCE(ci.component_product_id, si.product_id), 'entry',
    COALESCE(si.quantity * ci.quantity, si.quantity),
    'sale_cancelled', NEW.id,
    'Stock devuelto por cancelación de venta #' || NEW.receipt_number,
    datetime('now')
  FROM sale_items si LEFT JOIN combo_items ci ON ci.combo_product_id = si.product_id
  WHERE si.sale_id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_products_after_update
AFTER UPDATE ON products WHEN OLD.updated_at IS NOT NULL
BEGIN UPDATE products SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_customers_after_update
AFTER UPDATE ON customers WHEN OLD.updated_at IS NOT NULL
BEGIN UPDATE customers SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_sales_after_update
AFTER UPDATE ON sales WHEN OLD.updated_at IS NOT NULL
BEGIN UPDATE sales SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_users_after_update
AFTER UPDATE ON users WHEN OLD.updated_at IS NOT NULL
BEGIN UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_products_stock_adjustment
AFTER UPDATE OF current_stock ON products
WHEN OLD.current_stock != NEW.current_stock
  AND NEW.current_stock != OLD.current_stock - (
    SELECT COALESCE(SUM(quantity), 0) FROM sale_items
    WHERE product_id = NEW.id AND created_at > OLD.updated_at)
  AND NEW.current_stock != OLD.current_stock + OLD.current_stock
BEGIN
  INSERT INTO inventory_movements (product_id, type, quantity, reference_type, reference_id, notes, created_at)
  VALUES (NEW.id, 'adjustment', NEW.current_stock - OLD.current_stock,
    'manual_adjustment', NEW.id, 'Ajuste manual de inventario', datetime('now'));
END;
