-- Reservation lifecycle and guest data. Additive so existing sale-linked rows remain valid.
ALTER TABLE reservations ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE reservations ADD COLUMN guest_name TEXT;
ALTER TABLE reservations ADD COLUMN guest_email TEXT;
ALTER TABLE reservations ADD COLUMN guest_phone TEXT;
ALTER TABLE reservations ADD COLUMN customer_id INTEGER REFERENCES customers(id);
ALTER TABLE reservations ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));
ALTER TABLE reservations ADD COLUMN cancelled_at TEXT;

DROP TRIGGER IF EXISTS trg_reservations_no_overlap;
CREATE TRIGGER trg_reservations_validate
BEFORE INSERT ON reservations
BEGIN
  SELECT CASE WHEN NEW.check_in >= NEW.check_out
    THEN RAISE(ABORT, 'RESERVATION_INVALID_DATES: check-out debe ser posterior al check-in') END;
  SELECT CASE WHEN NEW.guests < 1 OR NEW.guests > 100
    THEN RAISE(ABORT, 'RESERVATION_INVALID_GUESTS: huéspedes inválidos') END;
  SELECT CASE WHEN NEW.guest_price < 0 OR NEW.total < 0
    THEN RAISE(ABORT, 'RESERVATION_INVALID_TOTAL: precios inválidos') END;
  SELECT CASE WHEN ROUND(NEW.total, 2) != ROUND((julianday(NEW.check_out) - julianday(NEW.check_in)) * NEW.guest_price * NEW.guests, 2)
    THEN RAISE(ABORT, 'RESERVATION_INVALID_TOTAL: el total no coincide') END;
  INSERT OR IGNORE INTO reservation_guards (product_id) VALUES (NEW.product_id);
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM reservations r
    WHERE r.product_id = NEW.product_id
      AND r.status != 'cancelled'
      AND r.check_in < NEW.check_out AND r.check_out > NEW.check_in
  ) THEN RAISE(ABORT, 'RESERVATION_OVERLAP: el producto ya está reservado') END;
END;

CREATE TRIGGER trg_reservations_validate_update
BEFORE UPDATE OF check_in, check_out, guests, guest_price, total, product_id, status ON reservations
BEGIN
  SELECT CASE WHEN NEW.check_in >= NEW.check_out
    THEN RAISE(ABORT, 'RESERVATION_INVALID_DATES: check-out debe ser posterior al check-in') END;
  SELECT CASE WHEN NEW.guests < 1 OR NEW.guests > 100
    THEN RAISE(ABORT, 'RESERVATION_INVALID_GUESTS: huéspedes inválidos') END;
  SELECT CASE WHEN ROUND(NEW.total, 2) != ROUND((julianday(NEW.check_out) - julianday(NEW.check_in)) * NEW.guest_price * NEW.guests, 2)
    THEN RAISE(ABORT, 'RESERVATION_INVALID_TOTAL: el total no coincide') END;
  SELECT CASE WHEN NEW.status != 'cancelled' AND EXISTS (
    SELECT 1 FROM reservations r
    WHERE r.id != NEW.id AND r.product_id = NEW.product_id AND r.status != 'cancelled'
      AND r.check_in < NEW.check_out AND r.check_out > NEW.check_in
  ) THEN RAISE(ABORT, 'RESERVATION_OVERLAP: el producto ya está reservado') END;
END;

CREATE INDEX IF NOT EXISTS idx_reservations_status_dates
  ON reservations(status, check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_reservations_customer ON reservations(customer_id);
CREATE INDEX IF NOT EXISTS idx_reservations_product_active_dates
  ON reservations(product_id, status, check_in, check_out);
