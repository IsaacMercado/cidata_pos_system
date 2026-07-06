-- ============================================================
-- POS System - Initial Migration
-- Cloudflare D1 (SQLite) Schema
-- ============================================================

-- ─── Sequences (for auto-numbering) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sequences (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO sequences (name, value) VALUES ('receipt_number', 0);

-- ─── Categories ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  parent_id INTEGER REFERENCES categories(id),
  is_active INTEGER NOT NULL DEFAULT 1,
  odoo_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_categories_odoo ON categories(odoo_id);

-- ─── Products ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  barcode TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category_id INTEGER REFERENCES categories(id),
  price REAL NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'unit',
  min_stock REAL NOT NULL DEFAULT 0,
  current_stock REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  odoo_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_odoo ON products(odoo_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

-- ─── Customers ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  document_type TEXT NOT NULL DEFAULT 'CI',
  document_number TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  credit_limit REAL NOT NULL DEFAULT 0,
  current_balance REAL NOT NULL DEFAULT 0,
  odoo_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_customers_document ON customers(document_type, document_number);
CREATE INDEX IF NOT EXISTS idx_customers_odoo ON customers(odoo_id);

-- ─── Users ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  pin TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'cashier',
  is_active INTEGER NOT NULL DEFAULT 1,
  odoo_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_odoo ON users(odoo_id);

-- ─── Payment Methods ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  odoo_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Sales ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_number TEXT NOT NULL UNIQUE,
  customer_id INTEGER REFERENCES customers(id),
  user_id INTEGER REFERENCES users(id),
  subtotal REAL NOT NULL DEFAULT 0,
  tax_total REAL NOT NULL DEFAULT 0,
  discount_total REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  payment_method_id INTEGER REFERENCES payment_methods(id),
  status TEXT NOT NULL DEFAULT 'completed',
  notes TEXT,
  odoo_id INTEGER,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sales_receipt ON sales(receipt_number);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_sync ON sales(sync_status);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_odoo ON sales(odoo_id);

-- ─── Sale Items ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  discount_percent REAL NOT NULL DEFAULT 0,
  discount_amount REAL NOT NULL DEFAULT 0,
  subtotal REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);

-- ─── Inventory Movements ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  type TEXT NOT NULL,
  quantity REAL NOT NULL,
  reference_type TEXT,
  reference_id INTEGER,
  notes TEXT,
  user_id INTEGER REFERENCES users(id),
  odoo_id INTEGER,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_type ON inventory_movements(type);
CREATE INDEX IF NOT EXISTS idx_inventory_sync ON inventory_movements(sync_status);
CREATE INDEX IF NOT EXISTS idx_inventory_created ON inventory_movements(created_at);

-- ─── Sync Log ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  odoo_response TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_log(status);
CREATE INDEX IF NOT EXISTS idx_sync_entity ON sync_log(entity_type, entity_id);

-- ─── Low Stock Alerts ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS low_stock_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  current_stock REAL NOT NULL,
  min_stock REAL NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_alerts_product ON low_stock_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON low_stock_alerts(resolved);

-- ============================================================
-- TRIGGERS - Business Logic
-- ============================================================

-- 1. Validate stock before adding items
CREATE TRIGGER IF NOT EXISTS trg_sale_items_before_insert
BEFORE INSERT ON sale_items
BEGIN
  SELECT CASE
    WHEN (SELECT current_stock FROM products WHERE id = NEW.product_id) < NEW.quantity
    THEN RAISE(ABORT, 'STOCK_INSUFFICIENT: No hay suficiente inventario disponible')
  END;
END;

-- 2. Auto-calculate totals and decrement stock after insert
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

-- 3. Restore totals and stock when items are removed
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

-- 4. Restore stock when sale is cancelled
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

-- 5. Auto-update timestamps
CREATE TRIGGER IF NOT EXISTS trg_products_after_update
AFTER UPDATE ON products
BEGIN
  UPDATE products SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_customers_after_update
AFTER UPDATE ON customers
BEGIN
  UPDATE customers SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_sales_after_update
AFTER UPDATE ON sales
BEGIN
  UPDATE sales SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_users_after_update
AFTER UPDATE ON users
BEGIN
  UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- 6. Log manual stock adjustments
CREATE TRIGGER IF NOT EXISTS trg_products_stock_adjustment
AFTER UPDATE OF current_stock ON products
WHEN ABS(OLD.current_stock - NEW.current_stock) > 0.001
  AND NEW.current_stock != OLD.current_stock - (
    SELECT COALESCE(SUM(quantity), 0)
    FROM sale_items WHERE product_id = NEW.id
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
