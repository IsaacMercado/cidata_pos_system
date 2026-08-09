-- Manual adjustments are recorded by the API in the same D1 batch as the
-- stock update. Remove the old time-window trigger to prevent duplicates.
DROP TRIGGER IF EXISTS trg_products_stock_adjustment;

-- Recreate the sale trigger so combo sales only register component exits.
DROP TRIGGER IF EXISTS trg_sale_items_after_insert;

CREATE TRIGGER trg_sale_items_after_insert
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
    current_stock = current_stock - (NEW.quantity * ci.quantity),
    updated_at = datetime('now')
  FROM combo_items ci
  WHERE products.id = ci.component_product_id
    AND ci.combo_product_id = NEW.product_id
    AND (SELECT product_type FROM products WHERE id = NEW.product_id) = 'combo';

  UPDATE products SET
    current_stock = current_stock - NEW.quantity,
    updated_at = datetime('now')
  WHERE id = NEW.product_id
    AND (SELECT product_type FROM products WHERE id = NEW.product_id) != 'combo';

  INSERT INTO inventory_movements (product_id, type, quantity, reference_type, reference_id, notes, created_at)
  SELECT ci.component_product_id, 'exit', -(ci.quantity * NEW.quantity), 'sale', NEW.sale_id,
    'Venta combo #' || (SELECT receipt_number FROM sales WHERE id = NEW.sale_id), datetime('now')
  FROM combo_items ci
  WHERE ci.combo_product_id = NEW.product_id
    AND (SELECT product_type FROM products WHERE id = NEW.product_id) = 'combo';

  INSERT INTO inventory_movements (product_id, type, quantity, reference_type, reference_id, notes, created_at)
  SELECT NEW.product_id, 'exit', -NEW.quantity, 'sale', NEW.sale_id,
    'Venta #' || (SELECT receipt_number FROM sales WHERE id = NEW.sale_id), datetime('now')
  WHERE (SELECT product_type FROM products WHERE id = NEW.product_id) != 'combo';
END;
