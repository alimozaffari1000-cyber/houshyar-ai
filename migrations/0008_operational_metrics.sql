-- Privacy-minimized operational metrics only. Never store prompts, messages, user IDs, IPs, or credentials.
CREATE TABLE IF NOT EXISTS operational_metrics (
  request_id TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('provider_success', 'provider_failure', 'comparison_success', 'comparison_failure')),
  provider TEXT NOT NULL CHECK (provider IN ('groq', 'anthropic', 'google', 'comparison', 'auto')),
  status INTEGER NOT NULL CHECK (status BETWEEN 0 AND 599),
  elapsed_ms INTEGER NOT NULL CHECK (elapsed_ms BETWEEN 0 AND 120000),
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_operational_metrics_created_provider
  ON operational_metrics(created_at DESC, provider, event);
