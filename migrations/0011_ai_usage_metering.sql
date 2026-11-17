PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS ai_usage_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  request_id TEXT NOT NULL UNIQUE,
  provider_code TEXT NOT NULL CHECK (provider_code IN ('groq', 'anthropic', 'google', 'comparison')),
  model_code TEXT NOT NULL CHECK (length(model_code) BETWEEN 1 AND 120),
  prompt_tokens INTEGER CHECK (prompt_tokens IS NULL OR prompt_tokens >= 0),
  completion_tokens INTEGER CHECK (completion_tokens IS NULL OR completion_tokens >= 0),
  total_tokens INTEGER CHECK (total_tokens IS NULL OR total_tokens >= 0),
  estimated_cost_micro_usd INTEGER CHECK (estimated_cost_micro_usd IS NULL OR estimated_cost_micro_usd >= 0),
  web_search_used INTEGER NOT NULL DEFAULT 0 CHECK (web_search_used IN (0, 1)),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created ON ai_usage_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_provider_created ON ai_usage_events(provider_code, created_at DESC);
CREATE TRIGGER IF NOT EXISTS trg_ai_usage_events_no_update BEFORE UPDATE ON ai_usage_events
BEGIN SELECT RAISE(ABORT, 'AI_USAGE_EVENTS_ARE_APPEND_ONLY'); END;
CREATE TRIGGER IF NOT EXISTS trg_ai_usage_events_no_delete BEFORE DELETE ON ai_usage_events
BEGIN SELECT RAISE(ABORT, 'AI_USAGE_EVENTS_ARE_APPEND_ONLY'); END;
