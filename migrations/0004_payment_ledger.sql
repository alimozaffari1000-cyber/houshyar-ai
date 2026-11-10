-- Houshyar payment foundation.
-- This migration creates bookkeeping tables only. It does not enable a processor,
-- create wallet addresses, accept payments, or grant credits automatically.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS payment_invoices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  provider_id TEXT NOT NULL,
  method_id TEXT NOT NULL,
  asset_code TEXT,
  network_code TEXT,
  base_amount_minor INTEGER NOT NULL CHECK (base_amount_minor > 0),
  base_currency TEXT NOT NULL,
  payment_amount_decimal TEXT,
  exchange_rate_decimal TEXT,
  destination_reference TEXT,
  destination_memo TEXT,
  provider_invoice_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirming', 'paid', 'underpaid', 'overpaid', 'expired', 'failed', 'manual_review', 'refunded')),
  expires_at INTEGER NOT NULL,
  confirmed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(provider_id, provider_invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_invoices_user_created
  ON payment_invoices(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_payment_invoices_status_expiry
  ON payment_invoices(status, expires_at);

CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES payment_invoices(id) ON DELETE RESTRICT,
  provider_id TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received', 'processed', 'rejected', 'failed')),
  received_at INTEGER NOT NULL,
  processed_at INTEGER,
  UNIQUE(provider_id, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_events_invoice
  ON payment_events(invoice_id, received_at);

-- Wallet balance is derived from this append-only ledger. Amounts are integer
-- service-credit units; this is not a cash balance and cannot be withdrawn.
CREATE TABLE IF NOT EXISTS wallet_ledger_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount_units INTEGER NOT NULL CHECK (amount_units <> 0),
  entry_type TEXT NOT NULL
    CHECK (entry_type IN ('top_up', 'usage', 'refund', 'adjustment', 'expiry')),
  reference_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user_created
  ON wallet_ledger_entries(user_id, created_at);

CREATE TABLE IF NOT EXISTS entitlement_grants (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL UNIQUE REFERENCES payment_invoices(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  grant_type TEXT NOT NULL CHECK (grant_type IN ('credits', 'subscription')),
  credit_units INTEGER NOT NULL DEFAULT 0 CHECK (credit_units >= 0),
  plan_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  plan_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  provider_subscription_id TEXT,
  status TEXT NOT NULL
    CHECK (status IN ('pending', 'active', 'past_due', 'cancelled', 'expired')),
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('month', 'year')),
  auto_renew_enabled INTEGER NOT NULL DEFAULT 0 CHECK (auto_renew_enabled IN (0, 1)),
  current_period_start INTEGER,
  current_period_end INTEGER,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0 CHECK (cancel_at_period_end IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(provider_id, provider_subscription_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status
  ON subscriptions(user_id, status);

-- Corrective entries are appended; existing wallet entries are never edited or deleted.
CREATE TRIGGER IF NOT EXISTS trg_wallet_ledger_no_update
BEFORE UPDATE ON wallet_ledger_entries
BEGIN
  SELECT RAISE(ABORT, 'WALLET_LEDGER_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_wallet_ledger_no_delete
BEFORE DELETE ON wallet_ledger_entries
BEGIN
  SELECT RAISE(ABORT, 'WALLET_LEDGER_IMMUTABLE');
END;
