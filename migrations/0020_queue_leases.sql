ALTER TABLE integration_operations ADD COLUMN lease_token TEXT;
ALTER TABLE integration_operations ADD COLUMN lease_until TEXT;
ALTER TABLE integration_operations ADD COLUMN next_attempt_at TEXT;

CREATE INDEX IF NOT EXISTS idx_integration_operations_ready
  ON integration_operations(status, next_attempt_at, created_at);
