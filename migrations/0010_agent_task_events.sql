-- Minimal audit trail for agent task lifecycle.
-- Store event metadata only; never persist prompts, credentials, provider payloads, or secrets here.
CREATE TABLE IF NOT EXISTS agent_task_events (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'task.created',
    'task.approval_recorded',
    'task.cancelled',
    'task.started',
    'task.progressed',
    'task.completed',
    'task.failed',
    'task.retry_scheduled'
  )),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system')),
  created_at INTEGER NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (length(metadata_json) <= 2048)
);

CREATE INDEX IF NOT EXISTS idx_agent_task_events_task_created
  ON agent_task_events(task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_task_events_user_created
  ON agent_task_events(user_id, created_at DESC);
