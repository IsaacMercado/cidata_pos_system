-- ============================================================
-- POS System - Idempotent sale pushes (client_id dedup)
-- ============================================================
-- Adds a client_id column to sales so the replication push route can
-- deduplicate retries by the offline document id, preventing duplicate
-- sales when RxDB re-sends a batch after a server error.

ALTER TABLE sales ADD COLUMN client_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS sales_client_id_idx ON sales(client_id);
