-- Task execution lifecycle metadata and append-only audit events.
PRAGMA foreign_keys = ON;

ALTER TABLE agent_tasks ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0);
ALTER TABLE agent_tasks ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 5);
ALTER TABLE agent_tasks ADD COLUMN lease_owner TEXT;
ALTER TABLE agent_tasks ADD COLUMN lease_expires_at INTEGER;
ALTER TABLE agent_tasks ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_tasks_user_idempotency
  ON agent_tasks(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_tasks_expired_leases
  ON agent_tasks(status, lease_expires_at)
  WHERE lease_expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS agent_task_events (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user','system','agent','worker')),
  actor_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('created','claimed','started','progress','approval_requested','approval_granted','approval_denied','completed','failed','retried','cancelled','lease_expired')),
  from_status TEXT,
  to_status TEXT,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_task_events_task
  ON agent_task_events(task_id, created_at ASC);
