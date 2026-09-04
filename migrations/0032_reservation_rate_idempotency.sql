-- Complete catalog publications must be able to replay reservation rates safely.
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservation_rates_product_guests
  ON reservation_rates(product_id, guests);
