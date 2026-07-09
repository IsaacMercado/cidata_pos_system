CREATE TABLE IF NOT EXISTS exchange_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  currency_from TEXT NOT NULL DEFAULT 'USD',
  currency_to TEXT NOT NULL DEFAULT 'VES',
  rate REAL NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR REPLACE INTO exchange_rates (currency_from, currency_to, rate, fetched_at) VALUES ('USD', 'VES', 0, '2000-01-01 00:00:00');
INSERT OR REPLACE INTO exchange_rates (currency_from, currency_to, rate, fetched_at) VALUES ('EUR', 'VES', 0, '2000-01-01 00:00:00');
