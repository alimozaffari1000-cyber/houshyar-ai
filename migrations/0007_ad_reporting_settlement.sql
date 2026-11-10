-- Reporting and settlement evidence. No client/API endpoint may self-assert a provider settlement.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ad_settlements (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES ad_campaigns(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL,
  provider_reference TEXT NOT NULL,
  gross_amount_minor INTEGER NOT NULL CHECK (gross_amount_minor >= 0),
  fees_minor INTEGER NOT NULL DEFAULT 0 CHECK (fees_minor >= 0),
  net_amount_minor INTEGER NOT NULL CHECK (net_amount_minor >= 0),
  currency_code TEXT NOT NULL,
  settled_at INTEGER NOT NULL,
  verified_at INTEGER NOT NULL,
  verification_source TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  CHECK (gross_amount_minor >= fees_minor),
  CHECK (net_amount_minor = gross_amount_minor - fees_minor),
  UNIQUE(provider, provider_reference)
);
CREATE INDEX IF NOT EXISTS idx_ad_settlements_campaign_time ON ad_settlements(campaign_id, settled_at);

ALTER TABLE ad_events ADD COLUMN fraud_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_ad_events_user_campaign_type_time
  ON ad_events(user_id, campaign_id, event_type, occurred_at);
