-- Durable, per-user agent task queue. Plans only; no worker execution is enabled by this migration.
CREATE TABLE IF NOT EXISTS agent_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  goal TEXT NOT NULL CHECK (length(goal) BETWEEN 1 AND 4000),
  agent_id TEXT NOT NULL CHECK (agent_id IN ('general', 'research', 'analyst', 'content', 'translator', 'planner', 'developer')),
  workflow_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'needs_approval', 'running', 'completed', 'failed', 'cancelled')),
  approval_required INTEGER NOT NULL DEFAULT 0 CHECK (approval_required IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  error_code TEXT
);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_user_created ON agent_tasks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status_created ON agent_tasks(status, created_at);
