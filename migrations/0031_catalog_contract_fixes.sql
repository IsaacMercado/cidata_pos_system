-- Fase 1/3: complete the stable catalog and sale snapshot contract.
ALTER TABLE products ADD COLUMN external_id TEXT;

UPDATE products
SET external_id = code
WHERE external_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_external_id
  ON products(external_id)
  WHERE external_id IS NOT NULL;
