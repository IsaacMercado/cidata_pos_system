-- Fase 3: immutable catalog references for sale audit and replication.
ALTER TABLE products ADD COLUMN catalog_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sale_items ADD COLUMN external_id_snapshot TEXT;
ALTER TABLE sale_items ADD COLUMN code_snapshot TEXT;
ALTER TABLE sale_items ADD COLUMN name_snapshot TEXT;
ALTER TABLE sale_items ADD COLUMN unit_snapshot TEXT;
ALTER TABLE sale_items ADD COLUMN tax_rate_snapshot REAL NOT NULL DEFAULT 0;
ALTER TABLE sale_items ADD COLUMN catalog_version_snapshot INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sale_item_components ADD COLUMN external_id_snapshot TEXT;
ALTER TABLE sale_item_components ADD COLUMN code_snapshot TEXT;
ALTER TABLE sale_item_components ADD COLUMN name_snapshot TEXT;
ALTER TABLE sale_item_components ADD COLUMN catalog_version_snapshot INTEGER NOT NULL DEFAULT 1;
UPDATE sale_items SET external_id_snapshot = (SELECT code FROM products WHERE products.id = sale_items.product_id), code_snapshot = (SELECT code FROM products WHERE products.id = sale_items.product_id), name_snapshot = (SELECT name FROM products WHERE products.id = sale_items.product_id), unit_snapshot = (SELECT unit FROM products WHERE products.id = sale_items.product_id), tax_rate_snapshot = COALESCE((SELECT tax_rate FROM products WHERE products.id = sale_items.product_id), 0), catalog_version_snapshot = COALESCE((SELECT catalog_version FROM products WHERE products.id = sale_items.product_id), 1) WHERE code_snapshot IS NULL;
UPDATE sale_item_components SET external_id_snapshot = (SELECT code FROM products WHERE products.id = sale_item_components.component_product_id), code_snapshot = (SELECT code FROM products WHERE products.id = sale_item_components.component_product_id), name_snapshot = (SELECT name FROM products WHERE products.id = sale_item_components.component_product_id), catalog_version_snapshot = COALESCE((SELECT catalog_version FROM products WHERE products.id = sale_item_components.component_product_id), 1) WHERE code_snapshot IS NULL;
DROP TRIGGER IF EXISTS trg_sale_item_component_snapshot;
CREATE TRIGGER trg_sale_item_snapshot AFTER INSERT ON sale_items BEGIN
  UPDATE sale_items SET external_id_snapshot = (SELECT code FROM products WHERE products.id = NEW.product_id), code_snapshot = (SELECT code FROM products WHERE products.id = NEW.product_id), name_snapshot = (SELECT name FROM products WHERE products.id = NEW.product_id), unit_snapshot = (SELECT unit FROM products WHERE products.id = NEW.product_id), tax_rate_snapshot = COALESCE((SELECT tax_rate FROM products WHERE products.id = NEW.product_id), 0), catalog_version_snapshot = COALESCE((SELECT catalog_version FROM products WHERE products.id = NEW.product_id), 1) WHERE id = NEW.id;
  INSERT INTO sale_item_components (sale_item_id, component_product_id, quantity, external_id_snapshot, code_snapshot, name_snapshot, catalog_version_snapshot) SELECT NEW.id, ci.component_product_id, ci.quantity * NEW.quantity, p.code, p.code, p.name, COALESCE(p.catalog_version, 1) FROM combo_items ci JOIN products combo ON combo.id = NEW.product_id AND combo.product_type = 'combo' JOIN products p ON p.id = ci.component_product_id WHERE ci.combo_product_id = NEW.product_id;
END;
