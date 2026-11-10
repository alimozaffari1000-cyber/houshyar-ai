-- Houshyar promotional draw foundation.
-- Paid entry is deliberately disabled; no payment or prize payout is implemented here.
CREATE TABLE IF NOT EXISTS draw_campaigns (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 120),
  description TEXT NOT NULL DEFAULT '',
  draw_mode TEXT NOT NULL DEFAULT 'free_promotional'
    CHECK (draw_mode IN ('free_promotional', 'paid_licensed')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'open', 'closed', 'drawn', 'cancelled')),
  jurisdiction_code TEXT NOT NULL DEFAULT 'UNSPECIFIED',
  currency_code TEXT NOT NULL DEFAULT 'USD',
  prize_description TEXT NOT NULL,
  starts_at TEXT,
  ends_at TEXT,
  draw_at TEXT,
  max_entries INTEGER NOT NULL DEFAULT 10000 CHECK (max_entries BETWEEN 1 AND 10000000),
  entries_per_user INTEGER NOT NULL DEFAULT 1 CHECK (entries_per_user BETWEEN 1 AND 100),
  entry_fee_minor INTEGER NOT NULL DEFAULT 0 CHECK (entry_fee_minor >= 0),
  paid_entry_enabled INTEGER NOT NULL DEFAULT 0 CHECK (paid_entry_enabled = 0),
  license_reference TEXT,
  rules_version TEXT NOT NULL DEFAULT '1.0',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  CHECK (draw_mode != 'free_promotional' OR entry_fee_minor = 0)
);

CREATE TABLE IF NOT EXISTS draw_entries (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES draw_campaigns(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL,
  ticket_code TEXT NOT NULL UNIQUE,
  entry_status TEXT NOT NULL DEFAULT 'eligible'
    CHECK (entry_status IN ('eligible', 'void')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (campaign_id, user_id),
  UNIQUE (campaign_id, id),
  UNIQUE (campaign_id, ticket_code)
);

CREATE INDEX IF NOT EXISTS idx_draw_entries_campaign_status
  ON draw_entries(campaign_id, entry_status, created_at);
CREATE INDEX IF NOT EXISTS idx_draw_entries_user_created
  ON draw_entries(user_id, created_at);

CREATE TABLE IF NOT EXISTS draw_results (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL UNIQUE REFERENCES draw_campaigns(id) ON DELETE RESTRICT,
  winning_entry_id TEXT NOT NULL,
  algorithm_version TEXT NOT NULL,
  entropy_commitment TEXT NOT NULL,
  entropy_reveal TEXT,
  selected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'failed')),
  FOREIGN KEY (campaign_id, winning_entry_id) REFERENCES draw_entries(campaign_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS draw_audit_events (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES draw_campaigns(id) ON DELETE RESTRICT,
  actor_user_id TEXT,
  event_type TEXT NOT NULL,
  event_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_draw_audit_campaign_created
  ON draw_audit_events(campaign_id, created_at);

CREATE TRIGGER IF NOT EXISTS trg_draw_results_no_update
BEFORE UPDATE ON draw_results
BEGIN
  SELECT RAISE(ABORT, 'DRAW_RESULT_IMMUTABLE');
END;
CREATE TRIGGER IF NOT EXISTS trg_draw_results_no_delete
BEFORE DELETE ON draw_results
BEGIN
  SELECT RAISE(ABORT, 'DRAW_RESULT_IMMUTABLE');
END;
CREATE TRIGGER IF NOT EXISTS trg_draw_audit_no_update
BEFORE UPDATE ON draw_audit_events
BEGIN
  SELECT RAISE(ABORT, 'DRAW_AUDIT_IMMUTABLE');
END;
CREATE TRIGGER IF NOT EXISTS trg_draw_audit_no_delete
BEFORE DELETE ON draw_audit_events
BEGIN
  SELECT RAISE(ABORT, 'DRAW_AUDIT_IMMUTABLE');
END;
