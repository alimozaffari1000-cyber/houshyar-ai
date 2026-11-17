-- Subscription entitlements and append-only usage-credit ledger.
-- This migration does not activate paid plans or charge customers.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  plan_code TEXT NOT NULL CHECK (plan_code IN ('free', 'plus', 'pro')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'past_due', 'cancelled', 'expired')),
  starts_at INTEGER,
  ends_at INTEGER,
  provider_code TEXT,
  provider_subscription_reference TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status
  ON user_subscriptions(user_id, status, ends_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscriptions_one_active
  ON user_subscriptions(user_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS user_credit_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('grant', 'consume', 'refund', 'adjustment', 'expiry')),
  credit_delta INTEGER NOT NULL CHECK (credit_delta <> 0),
  reference_type TEXT,
  reference_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  note_code TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_created
  ON user_credit_ledger(user_id, created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_credit_ledger_no_update
BEFORE UPDATE ON user_credit_ledger
BEGIN
  SELECT RAISE(ABORT, 'CREDIT_LEDGER_IS_APPEND_ONLY');
END;

CREATE TRIGGER IF NOT EXISTS trg_credit_ledger_no_delete
BEFORE DELETE ON user_credit_ledger
BEGIN
  SELECT RAISE(ABORT, 'CREDIT_LEDGER_IS_APPEND_ONLY');
END;
