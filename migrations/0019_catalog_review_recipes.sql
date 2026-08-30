-- Catalog review workflow and theoretical consumption recipes.
ALTER TABLE products ADD COLUMN catalog_status TEXT NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_products_catalog_status
  ON products(catalog_status);

CREATE TABLE IF NOT EXISTS recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(product_id)
);

CREATE TABLE IF NOT EXISTS recipe_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  component_product_id INTEGER NOT NULL REFERENCES products(id),
  quantity REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK(quantity > 0),
  UNIQUE(recipe_id, component_product_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_items_recipe ON recipe_items(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_component ON recipe_items(component_product_id);

-- No endpoint may leave the operational balance below zero.
CREATE TRIGGER IF NOT EXISTS trg_products_prevent_negative_stock
BEFORE UPDATE OF current_stock ON products
WHEN NEW.current_stock < 0
BEGIN
  SELECT RAISE(ABORT, 'STOCK_NEGATIVE: El inventario no puede quedar negativo');
END;
