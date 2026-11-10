-- Advertising marketplace foundation.
-- This migration stores campaigns, deduplicated events, referrals and service-credit rewards.
-- It does not enable ad serving, bill advertisers, or permit cash/crypto withdrawals.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ad_campaigns (
  id TEXT PRIMARY KEY,
  advertiser_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  creative_payload TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  pricing_model TEXT NOT NULL CHECK (pricing_model IN ('cpm', 'cpc', 'cpa', 'barter')),
  budget_minor INTEGER NOT NULL DEFAULT 0 CHECK (budget_minor >= 0),
  currency_code TEXT NOT NULL DEFAULT 'USD',
  reward_rate_bps INTEGER NOT NULL DEFAULT 500 CHECK (reward_rate_bps BETWEEN 0 AND 10000),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_review', 'approved', 'paused', 'rejected', 'ended')),
  starts_at INTEGER,
  ends_at INTEGER,
  reviewed_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status_schedule ON ad_campaigns(status, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_advertiser_created ON ad_campaigns(advertiser_user_id, created_at);

CREATE TABLE IF NOT EXISTS ad_events (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES ad_campaigns(id) ON DELETE RESTRICT,
  user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('impression', 'click', 'conversion', 'invalidated')),
  dedupe_key TEXT NOT NULL UNIQUE,
  validation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (validation_status IN ('pending', 'valid', 'rejected', 'review')),
  risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  occurred_at INTEGER NOT NULL,
  validated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_ad_events_campaign_type_time ON ad_events(campaign_id, event_type, occurred_at);
CREATE INDEX IF NOT EXISTS idx_ad_events_user_time ON ad_events(user_id, occurred_at);

CREATE TABLE IF NOT EXISTS ad_referral_codes (
  code TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS referral_attributions (
  id TEXT PRIMARY KEY,
  referrer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  referred_user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  referral_code TEXT NOT NULL REFERENCES ad_referral_codes(code) ON DELETE RESTRICT,
  attributed_at INTEGER NOT NULL,
  conversion_at INTEGER,
  status TEXT NOT NULL DEFAULT 'attributed'
    CHECK (status IN ('attributed', 'qualified', 'rejected', 'expired')),
  UNIQUE(referrer_user_id, referred_user_id),
  CHECK (referrer_user_id <> referred_user_id)
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_status ON referral_attributions(referrer_user_id, status, attributed_at);

-- Positive and negative service-credit entries; corrections are appended, never edited.
CREATE TABLE IF NOT EXISTS ad_reward_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  campaign_id TEXT REFERENCES ad_campaigns(id) ON DELETE RESTRICT,
  amount_units INTEGER NOT NULL CHECK (amount_units <> 0),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('reward_grant', 'reward_reversal', 'manual_adjustment')),
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ad_reward_ledger_user_created ON ad_reward_ledger(user_id, created_at);
CREATE TRIGGER IF NOT EXISTS trg_ad_reward_ledger_no_update BEFORE UPDATE ON ad_reward_ledger
BEGIN SELECT RAISE(ABORT, 'AD_REWARD_LEDGER_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_ad_reward_ledger_no_delete BEFORE DELETE ON ad_reward_ledger
BEGIN SELECT RAISE(ABORT, 'AD_REWARD_LEDGER_IMMUTABLE'); END;
