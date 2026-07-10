-- Add pin_hash column for offline PIN verification (PBKDF2, format: pbkdf2_sha256$ITER$SALT$HASH)
ALTER TABLE users ADD COLUMN pin_hash TEXT;
