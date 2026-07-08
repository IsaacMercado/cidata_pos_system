ALTER TABLE users ADD COLUMN is_superuser INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS user_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  screen TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_permissions_user_screen ON user_permissions(user_id, screen);

UPDATE users SET is_superuser = 1 WHERE username = 'admin';
