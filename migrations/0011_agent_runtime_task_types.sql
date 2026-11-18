-- Add an explicit task type boundary before any background consumer is enabled.
-- Existing free-text requests remain assistant_request and are never auto-dispatched.
ALTER TABLE agent_tasks ADD COLUMN task_type TEXT NOT NULL DEFAULT 'assistant_request'
  CHECK (task_type IN ('assistant_request','project_health_report','translation_catalog_audit','agent_team_audit'));
ALTER TABLE agent_tasks ADD COLUMN payload_json TEXT
  CHECK (payload_json IS NULL OR length(payload_json) <= 4000);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_runtime_dispatch
  ON agent_tasks(status, task_type, priority ASC, created_at ASC);
