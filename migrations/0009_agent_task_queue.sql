-- Durable user-owned agent task queue. Tasks are queued only; no autonomous execution is enabled.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS agent_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 2 AND 120),
  input_text TEXT NOT NULL CHECK (length(input_text) BETWEEN 1 AND 6000),
  agent_id TEXT NOT NULL CHECK (agent_id IN ('general','research','analyst','content','translator','planner','developer')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','in_progress','awaiting_approval','completed','failed','cancelled')),
  priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  result_text TEXT CHECK (result_text IS NULL OR length(result_text) <= 12000),
  error_code TEXT CHECK (error_code IS NULL OR length(error_code) <= 80),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_user_created
  ON agent_tasks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_queue
  ON agent_tasks(status, priority ASC, created_at ASC);
