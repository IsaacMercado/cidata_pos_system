-- ─── Purchase Orders (reception orders) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_number TEXT NOT NULL UNIQUE,
  user_id INTEGER REFERENCES users(id),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_receipt ON purchase_orders(receipt_number);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);

-- ─── Purchase Order Items ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity REAL NOT NULL CHECK (quantity > 0),
  unit_cost REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_po_items_order ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_items_product ON purchase_order_items(product_id);

-- ─── Drop old triggers that interfere ────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_products_stock_adjustment;
DROP TRIGGER IF EXISTS trg_sale_items_before_insert;
DROP TRIGGER IF EXISTS trg_sale_items_after_insert;
DROP TRIGGER IF EXISTS trg_sale_items_after_delete;
DROP TRIGGER IF EXISTS trg_sales_after_cancel;

-- ─── Recreate: validate stock before adding items ────────────────────────────
CREATE TRIGGER IF NOT EXISTS trg_sale_items_before_insert
BEFORE INSERT ON sale_items
BEGIN
  SELECT CASE
    WHEN (SELECT current_stock FROM products WHERE id = NEW.product_id) < NEW.quantity
    THEN RAISE(ABORT, 'STOCK_INSUFFICIENT: No hay suficiente inventario disponible')
  END;
END;

-- ─── Recreate: auto-calc totals and decrement stock after sale item insert ────
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

-- ─── Recreate: restore totals and stock when items are removed ───────────────
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

-- ─── Recreate: restore stock when sale is cancelled ─────────────────────────
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

-- ─── Trigger: add stock when purchase order item is inserted ─────────────────
CREATE TRIGGER IF NOT EXISTS trg_po_items_after_insert
AFTER INSERT ON purchase_order_items
BEGIN
  UPDATE products SET
    current_stock = current_stock + NEW.quantity,
    updated_at = datetime('now')
  WHERE id = NEW.product_id;

  INSERT INTO inventory_movements (
    product_id, type, quantity, reference_type, reference_id, notes, created_at
  ) VALUES (
    NEW.product_id, 'entry', NEW.quantity, 'purchase_order', NEW.purchase_order_id,
    'Compra #' || (SELECT receipt_number FROM purchase_orders WHERE id = NEW.purchase_order_id),
    datetime('now')
  );
END;

-- ─── Auto-update timestamps ──────────────────────────────────────────────────
CREATE TRIGGER IF NOT EXISTS trg_purchase_orders_after_update
AFTER UPDATE ON purchase_orders
BEGIN
  UPDATE purchase_orders SET updated_at = datetime('now') WHERE id = NEW.id;
END;