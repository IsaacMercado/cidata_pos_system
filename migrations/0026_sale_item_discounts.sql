-- Store the detailed list of per-line discounts (sequential fixed/percent).
ALTER TABLE sale_items ADD COLUMN discounts TEXT NOT NULL DEFAULT '[]';
