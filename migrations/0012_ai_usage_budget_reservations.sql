-- Atomic per-user daily AI spend reservations. Repository-only migration; do not apply automatically.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ai_usage_budget_reservations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  request_id TEXT NOT NULL UNIQUE,
  usage_date TEXT NOT NULL CHECK (length(usage_date) = 10),
  reserved_cost_micro_usd INTEGER NOT NULL CHECK (reserved_cost_micro_usd > 0),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_budget_reservations_user_day
  ON ai_usage_budget_reservations(user_id, usage_date, expires_at);
