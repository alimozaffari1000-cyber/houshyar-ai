-- In-app notifications for marketplace buyers and sellers.
-- Apply only after migrations 0006 and 0007 in a verified Pages D1 environment.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS user_notifications (
  id TEXT PRIMARY KEY,
  recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('marketplace_order_received', 'marketplace_order_status')),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  body TEXT NOT NULL DEFAULT '' CHECK (length(body) <= 500),
  entity_type TEXT NOT NULL DEFAULT 'order' CHECK (entity_type = 'order'),
  entity_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_inbox
  ON user_notifications(recipient_user_id, read_at, created_at DESC);
