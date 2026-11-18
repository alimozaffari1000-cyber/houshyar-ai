-- Houshyar Developer Platform foundation.
-- This migration creates metadata tables only. It does not issue API keys,
-- publish apps, execute third-party code, or enable billing.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS developer_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 2 AND 100),
  website_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS developer_projects (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 100),
  environment TEXT NOT NULL DEFAULT 'development'
    CHECK (environment IN ('development', 'staging', 'production')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'revoked')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_developer_projects_owner
  ON developer_projects(owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS developer_api_keys (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES developer_projects(id) ON DELETE CASCADE,
  key_prefix TEXT NOT NULL CHECK (length(key_prefix) BETWEEN 6 AND 24),
  secret_hash TEXT NOT NULL UNIQUE,
  scopes_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  last_used_at INTEGER,
  revoked_at INTEGER,
  CHECK (expires_at IS NULL OR expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_developer_api_keys_project
  ON developer_api_keys(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_developer_api_keys_active
  ON developer_api_keys(secret_hash, expires_at, revoked_at);

CREATE TABLE IF NOT EXISTS developer_apps (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES developer_projects(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 100),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  category TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'unlisted', 'public')),
  review_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (review_status IN ('draft', 'submitted', 'approved', 'rejected', 'suspended')),
  permissions_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_developer_apps_catalog
  ON developer_apps(visibility, review_status, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_developer_apps_project
  ON developer_apps(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS developer_app_versions (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL REFERENCES developer_apps(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  artifact_digest TEXT,
  release_notes TEXT NOT NULL DEFAULT '' CHECK (length(release_notes) <= 4000),
  review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  created_at INTEGER NOT NULL,
  UNIQUE(app_id, version)
);

CREATE INDEX IF NOT EXISTS idx_developer_app_versions_app
  ON developer_app_versions(app_id, created_at DESC);

CREATE TABLE IF NOT EXISTS developer_usage_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES developer_projects(id) ON DELETE RESTRICT,
  product_code TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1 CHECK (request_count > 0),
  billable_units INTEGER NOT NULL DEFAULT 0 CHECK (billable_units >= 0),
  estimated_cost_microunits INTEGER NOT NULL DEFAULT 0
    CHECK (estimated_cost_microunits >= 0),
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'rejected', 'error')),
  idempotency_key TEXT,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_developer_usage_idempotency
  ON developer_usage_events(project_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_developer_usage_project_date
  ON developer_usage_events(project_id, created_at DESC);
