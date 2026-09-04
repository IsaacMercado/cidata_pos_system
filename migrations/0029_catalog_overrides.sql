CREATE TABLE IF NOT EXISTS catalog_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  override_type TEXT NOT NULL CHECK (override_type IN ('price', 'discount')),
  value TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  reason TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  approved_by INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'reconciled', 'rejected')),
  valid_from TEXT NOT NULL,
  valid_until TEXT,
  odoo_synced_at TEXT,
  odoo_reference TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE INDEX IF NOT EXISTS idx_catalog_overrides_product_status_window
  ON catalog_overrides(product_id, status, valid_from, valid_until);
