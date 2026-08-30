-- Durable sale outbox and purchase receiving.
-- The PO trigger used to receive stock when an order was created, which made
-- a draft order indistinguishable from a physical receipt.
DROP TRIGGER IF EXISTS trg_po_items_after_insert;

-- Reservation writes are guarded inside SQLite's write transaction. The API
-- pre-check remains useful for a friendly response, while this trigger closes
-- the check-then-insert race between concurrent Worker requests.
CREATE TABLE IF NOT EXISTS reservation_guards (
  product_id INTEGER PRIMARY KEY REFERENCES products(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER IF NOT EXISTS trg_reservations_no_overlap
BEFORE INSERT ON reservations
BEGIN
  INSERT OR IGNORE INTO reservation_guards (product_id) VALUES (NEW.product_id);
  SELECT CASE WHEN EXISTS (
    SELECT 1
    FROM reservations r
    JOIN sale_items si ON si.id = r.sale_item_id
    JOIN sales s ON s.id = si.sale_id
    WHERE r.product_id = NEW.product_id
      AND r.check_in < NEW.check_out
      AND r.check_out > NEW.check_in
      AND s.status != 'cancelled'
  ) THEN RAISE(ABORT, 'RESERVATION_OVERLAP: El producto ya está reservado para esas fechas') END;
END;

CREATE INDEX IF NOT EXISTS idx_reservations_product_dates
  ON reservations(product_id, check_in, check_out);
