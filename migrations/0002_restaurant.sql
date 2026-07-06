-- ============================================================
-- POS System - Restaurant Module
-- Tables for restaurant management and floor layout
-- ============================================================

CREATE TABLE IF NOT EXISTS restaurants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','occupied','reserved','maintenance')),
  shape TEXT NOT NULL DEFAULT 'circle' CHECK (shape IN ('circle','rectangle')),
  pos_x REAL NOT NULL DEFAULT 0,
  pos_y REAL NOT NULL DEFAULT 0,
  width REAL NOT NULL DEFAULT 60,
  height REAL NOT NULL DEFAULT 60,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_restaurant_tables_restaurant ON restaurant_tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_status ON restaurant_tables(status);

-- Link sales to restaurant tables
ALTER TABLE sales ADD COLUMN table_id INTEGER REFERENCES restaurant_tables(id);
ALTER TABLE sales ADD COLUMN table_name TEXT;

CREATE INDEX IF NOT EXISTS idx_sales_table ON sales(table_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- When a sale is created with a table, mark table as occupied
CREATE TRIGGER IF NOT EXISTS trg_sales_after_insert_table
AFTER INSERT ON sales
WHEN NEW.table_id IS NOT NULL
BEGIN
  UPDATE restaurant_tables SET status = 'occupied', updated_at = datetime('now')
  WHERE id = NEW.table_id;

  UPDATE sales SET table_name = (
    SELECT name FROM restaurant_tables WHERE id = NEW.table_id
  ) WHERE id = NEW.id;
END;

-- When a sale gets reassigned to a different table, update occupancy
CREATE TRIGGER IF NOT EXISTS trg_sales_after_table_assign
AFTER UPDATE OF table_id ON sales
WHEN NEW.table_id IS NOT NULL AND (OLD.table_id IS NULL OR OLD.table_id != NEW.table_id)
BEGIN
  UPDATE restaurant_tables SET status = 'occupied', updated_at = datetime('now')
  WHERE id = NEW.table_id;

  UPDATE sales SET table_name = (
    SELECT name FROM restaurant_tables WHERE id = NEW.table_id
  ) WHERE id = NEW.id;
END;

-- When a sale is completed or cancelled, free the table
CREATE TRIGGER IF NOT EXISTS trg_sales_after_complete_free_table
AFTER UPDATE OF status ON sales
WHEN NEW.status IN ('completed', 'cancelled')
  AND (OLD.status NOT IN ('completed', 'cancelled') OR OLD.status IS NULL)
  AND NEW.table_id IS NOT NULL
BEGIN
  UPDATE restaurant_tables SET status = 'available', updated_at = datetime('now')
  WHERE id = NEW.table_id;
END;

-- When a sale is created already completed with a table, occupy then free (quick POS with table)
CREATE TRIGGER IF NOT EXISTS trg_sales_after_insert_completed_table
AFTER INSERT ON sales
WHEN NEW.table_id IS NOT NULL AND NEW.status = 'completed'
BEGIN
  UPDATE restaurant_tables SET status = 'available', updated_at = datetime('now')
  WHERE id = NEW.table_id;
END;

-- Auto-update timestamps
CREATE TRIGGER IF NOT EXISTS trg_restaurants_after_update
AFTER UPDATE ON restaurants
BEGIN
  UPDATE restaurants SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_restaurant_tables_after_update
AFTER UPDATE ON restaurant_tables
BEGIN
  UPDATE restaurant_tables SET updated_at = datetime('now') WHERE id = NEW.id;
END;
