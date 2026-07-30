-- ============================================================
-- POS System - Combos (product bundles) & Reservations
-- ============================================================

-- ─── 1. Add product_type to products ──────────────────────────
ALTER TABLE products ADD COLUMN product_type TEXT NOT NULL DEFAULT 'simple';

-- ─── 2. Combo items (components of a combo product) ──────────
CREATE TABLE IF NOT EXISTS combo_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  combo_product_id INTEGER NOT NULL REFERENCES products(id),
  component_product_id INTEGER NOT NULL REFERENCES products(id),
  quantity REAL NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_combo_items_combo ON combo_items(combo_product_id);

-- ─── 3. Reservation rates (pricing by guest count) ───────────
CREATE TABLE IF NOT EXISTS reservation_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  guests INTEGER NOT NULL DEFAULT 1,
  price REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reservation_rates_product ON reservation_rates(product_id);

-- ─── 4. Reservations (hotel/room bookings) ───────────────────
CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  sale_item_id INTEGER REFERENCES sale_items(id),
  check_in TEXT NOT NULL,
  check_out TEXT NOT NULL,
  guests INTEGER NOT NULL DEFAULT 1,
  guest_price REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reservations_sale_item ON reservations(sale_item_id);

-- ─── 5. Drop old stock triggers and recreate with combo support ──

DROP TRIGGER IF EXISTS trg_sale_items_before_insert;

CREATE TRIGGER IF NOT EXISTS trg_sale_items_before_insert
BEFORE INSERT ON sale_items
BEGIN
  -- Check combo components stock
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

  -- Check simple product stock
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

  -- Combo: decrement component stock instead of combo product
  UPDATE products SET
    current_stock = current_stock - (NEW.quantity * ci_qty.component_qty),
    updated_at = datetime('now')
  FROM (
    SELECT combo_product_id, component_product_id, quantity AS component_qty
    FROM combo_items
    WHERE combo_product_id = NEW.product_id
  ) AS ci_qty
  WHERE products.id = ci_qty.component_product_id
    AND (SELECT product_type FROM products WHERE id = NEW.product_id) = 'combo';

  -- Simple/reservation: decrement own stock
  UPDATE products SET
    current_stock = current_stock - NEW.quantity,
    updated_at = datetime('now')
  WHERE id = NEW.product_id
    AND (SELECT product_type FROM products WHERE id = NEW.product_id) != 'combo';

  -- Inventory movements: combo → for each component
  INSERT INTO inventory_movements (
    product_id, type, quantity, reference_type, reference_id, notes, created_at
  )
  SELECT
    ci.component_product_id, 'exit', -(ci.quantity * NEW.quantity),
    'sale', NEW.sale_id,
    'Venta combo #' || (SELECT receipt_number FROM sales WHERE id = NEW.sale_id)
      || ' - ' || (SELECT name FROM products WHERE id = NEW.product_id),
    datetime('now')
  FROM combo_items ci
  WHERE ci.combo_product_id = NEW.product_id
    AND (SELECT product_type FROM products WHERE id = NEW.product_id) = 'combo';

  -- Inventory movement: simple/reservation → own product
  INSERT INTO inventory_movements (
    product_id, type, quantity, reference_type, reference_id, notes, created_at
  ) VALUES (
    NEW.product_id, 'exit', -NEW.quantity, 'sale', NEW.sale_id,
    'Venta #' || (SELECT receipt_number FROM sales WHERE id = NEW.sale_id),
    datetime('now')
  );

  -- Low stock alerts: skip for combos (components are checked separately)
  INSERT INTO low_stock_alerts (product_id, current_stock, min_stock, created_at)
  SELECT
    CASE WHEN (SELECT product_type FROM products WHERE id = NEW.product_id) = 'combo'
      THEN ci.component_product_id
      ELSE NEW.product_id
    END,
    p.current_stock, p.min_stock, datetime('now')
  FROM products p
  LEFT JOIN combo_items ci ON ci.combo_product_id = NEW.product_id
  WHERE p.id IN (
    SELECT CASE WHEN (SELECT product_type FROM products WHERE id = NEW.product_id) = 'combo'
      THEN ci.component_product_id
      ELSE NEW.product_id
    END
  )
    AND p.current_stock <= p.min_stock
    AND p.min_stock > 0
    AND p.id NOT IN (
      SELECT product_id FROM low_stock_alerts
      WHERE product_id = p.id AND resolved = 0
    );
END;

DROP TRIGGER IF EXISTS trg_sale_items_after_delete;

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

  -- Restore combo components
  UPDATE products SET
    current_stock = current_stock + OLD.quantity * ci.component_qty,
    updated_at = datetime('now')
  FROM (
    SELECT combo_product_id, component_product_id, quantity AS component_qty
    FROM combo_items
    WHERE combo_product_id = OLD.product_id
  ) AS ci
  WHERE products.id = ci.component_product_id;

  -- Restore own stock (non-combo)
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
  -- Restore combo components
  UPDATE products SET
    current_stock = current_stock + (
      SELECT COALESCE(SUM(si.quantity * ci.quantity), 0)
      FROM sale_items si
      JOIN combo_items ci ON ci.combo_product_id = si.product_id
      WHERE si.sale_id = NEW.id AND ci.component_product_id = products.id
    ),
    updated_at = datetime('now')
  WHERE id IN (
    SELECT ci.component_product_id
    FROM sale_items si
    JOIN combo_items ci ON ci.combo_product_id = si.product_id
    WHERE si.sale_id = NEW.id
  );

  -- Restore simple product stock
  UPDATE products SET
    current_stock = current_stock + (
      SELECT COALESCE(SUM(si.quantity), 0)
      FROM sale_items si
      WHERE si.sale_id = NEW.id AND si.product_id = products.id
    ),
    updated_at = datetime('now')
  WHERE id IN (
    SELECT si.product_id FROM sale_items si
    WHERE si.sale_id = NEW.id
    AND (SELECT product_type FROM products WHERE si.product_id = products.id) != 'combo'
  );

  INSERT INTO inventory_movements (
    product_id, type, quantity, reference_type, reference_id, notes, created_at
  )
  SELECT DISTINCT
    COALESCE(ci.component_product_id, si.product_id),
    'entry',
    COALESCE(si.quantity * ci.quantity, si.quantity),
    'sale_cancelled', NEW.id,
    'Stock devuelto por cancelación de venta #' || NEW.receipt_number,
    datetime('now')
  FROM sale_items si
  LEFT JOIN combo_items ci ON ci.combo_product_id = si.product_id
  WHERE si.sale_id = NEW.id;
END;
