-- Add email + password_hash columns for web auth (JWT-based login/register)
ALTER TABLE users ADD COLUMN email TEXT UNIQUE;
ALTER TABLE users ADD COLUMN password_hash TEXT;

-- Set default emails for existing seed users (passwords must be set via register flow)
UPDATE users SET email = 'admin@pos.local' WHERE username = 'admin' AND email IS NULL;
UPDATE users SET email = 'cashier1@pos.local' WHERE username = 'cashier1' AND email IS NULL;
