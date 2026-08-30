CREATE TABLE IF NOT EXISTS sale_item_components (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_item_id INTEGER NOT NULL REFERENCES sale_items(id),
  component_product_id INTEGER NOT NULL REFERENCES products(id),
  quantity REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sale_item_components_sale_item
  ON sale_item_components(sale_item_id);

-- Backfill sales created before this migration. The guard keeps reapplication safe.
INSERT INTO sale_item_components (sale_item_id, component_product_id, quantity)
SELECT si.id, ci.component_product_id, ci.quantity * si.quantity
FROM sale_items si
JOIN combo_items ci ON ci.combo_product_id = si.product_id
JOIN products p ON p.id = si.product_id AND p.product_type = 'combo'
WHERE NOT EXISTS (
  SELECT 1 FROM sale_item_components existing
  WHERE existing.sale_item_id = si.id
);

-- Capture the exact combo composition at sale time.
CREATE TRIGGER IF NOT EXISTS trg_sale_item_component_snapshot
AFTER INSERT ON sale_items
WHEN (SELECT product_type FROM products WHERE id = NEW.product_id) = 'combo'
BEGIN
  INSERT INTO sale_item_components (sale_item_id, component_product_id, quantity)
  SELECT NEW.id, component_product_id, quantity * NEW.quantity
  FROM combo_items
  WHERE combo_product_id = NEW.product_id;
END;

DROP TRIGGER IF EXISTS trg_sales_after_cancel;

CREATE TRIGGER trg_sales_after_cancel
AFTER UPDATE OF status ON sales
WHEN NEW.status = 'cancelled' AND OLD.status != 'cancelled'
BEGIN
  UPDATE products SET
    current_stock = current_stock + (
      SELECT COALESCE(SUM(sic.quantity), 0)
      FROM sale_items si
      JOIN sale_item_components sic ON sic.sale_item_id = si.id
      WHERE si.sale_id = NEW.id AND sic.component_product_id = products.id
    ),
    updated_at = datetime('now')
  WHERE id IN (
    SELECT sic.component_product_id
    FROM sale_items si
    JOIN sale_item_components sic ON sic.sale_item_id = si.id
    WHERE si.sale_id = NEW.id
  );

  UPDATE products SET
    current_stock = current_stock + (
      SELECT COALESCE(SUM(si.quantity), 0)
      FROM sale_items si
      WHERE si.sale_id = NEW.id AND si.product_id = products.id
        AND (SELECT product_type FROM products WHERE id = si.product_id) != 'combo'
    ),
    updated_at = datetime('now')
  WHERE id IN (
    SELECT si.product_id FROM sale_items si
    WHERE si.sale_id = NEW.id
      AND (SELECT product_type FROM products WHERE id = si.product_id) != 'combo'
  );

  INSERT INTO inventory_movements (
    product_id, type, quantity, reference_type, reference_id, notes, created_at
  )
  SELECT sic.component_product_id, 'entry', sic.quantity,
    'sale_cancelled', NEW.id,
    'Stock devuelto por cancelación de venta #' || NEW.receipt_number,
    datetime('now')
  FROM sale_items si
  JOIN sale_item_components sic ON sic.sale_item_id = si.id
  WHERE si.sale_id = NEW.id;

  INSERT INTO inventory_movements (
    product_id, type, quantity, reference_type, reference_id, notes, created_at
  )
  SELECT si.product_id, 'entry', si.quantity,
    'sale_cancelled', NEW.id,
    'Stock devuelto por cancelación de venta #' || NEW.receipt_number,
    datetime('now')
  FROM sale_items si
  WHERE si.sale_id = NEW.id
    AND (SELECT product_type FROM products WHERE id = si.product_id) != 'combo';
END;
