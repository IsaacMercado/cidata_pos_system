-- Product variants use the existing products document/row as the sellable item.
CREATE TABLE IF NOT EXISTS variant_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(product_id)
);
CREATE TABLE IF NOT EXISTS variant_attributes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES variant_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  UNIQUE(group_id, name)
);
CREATE TABLE IF NOT EXISTS product_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES variant_groups(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL UNIQUE REFERENCES products(id),
  values_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
ALTER TABLE products ADD COLUMN variant_group_id INTEGER REFERENCES variant_groups(id);
ALTER TABLE products ADD COLUMN variant_attributes TEXT NOT NULL DEFAULT '[]';
ALTER TABLE products ADD COLUMN variant_values TEXT NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_products_variant_group ON products(variant_group_id);
CREATE INDEX IF NOT EXISTS idx_variant_attributes_group ON variant_attributes(group_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_group ON product_variants(group_id);
