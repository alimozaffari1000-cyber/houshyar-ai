-- Per-account encrypted-in-transit workspace snapshot storage.
-- Repository-only migration; do not apply automatically.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspace_snapshots (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  payload_json TEXT NOT NULL CHECK (length(payload_json) <= 262144),
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_snapshots_updated_at
  ON workspace_snapshots(updated_at);
