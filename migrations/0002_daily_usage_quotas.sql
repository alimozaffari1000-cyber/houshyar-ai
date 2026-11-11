-- Daily per-user chat quotas. UTC calendar days are used for predictable resets.
CREATE TABLE IF NOT EXISTS daily_usage (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usage_date TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, usage_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_usage_date ON daily_usage(usage_date);
