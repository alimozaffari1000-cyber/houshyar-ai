-- Payment-intent and append-only event ledger foundation.
-- No provider is enabled by this migration; do not apply remotely without a reviewed rollout.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS marketplace_payment_intents (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  buyer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency_code TEXT NOT NULL CHECK (currency_code GLOB '[A-Z][A-Z][A-Z]'),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('manual', 'crypto')),
  asset_code TEXT,
  network_code TEXT,
  provider_code TEXT NOT NULL CHECK (length(provider_code) BETWEEN 2 AND 40),
  provider_reference TEXT UNIQUE,
  destination_address TEXT,
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'pending', 'confirmed', 'failed', 'expired', 'refunded')),
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 100),
  quote_rate TEXT,
  quote_expires_at INTEGER,
  expires_at INTEGER,
  confirmed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (
    (payment_method = 'manual' AND asset_code IS NULL AND network_code IS NULL) OR
    (payment_method = 'crypto' AND asset_code IS NOT NULL AND network_code IS NOT NULL)
  ),
  UNIQUE (buyer_user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_order_created
  ON marketplace_payment_intents(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_intents_buyer_created
  ON marketplace_payment_intents(buyer_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_intents_status_expiry
  ON marketplace_payment_intents(status, expires_at);

CREATE TABLE IF NOT EXISTS marketplace_payment_events (
  id TEXT PRIMARY KEY,
  payment_intent_id TEXT NOT NULL REFERENCES marketplace_payment_intents(id) ON DELETE RESTRICT,
  provider_code TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (length(event_type) BETWEEN 2 AND 80),
  event_status TEXT NOT NULL CHECK (event_status IN ('received', 'verified', 'rejected')),
  amount_minor INTEGER,
  asset_code TEXT,
  network_code TEXT,
  transaction_reference TEXT,
  safe_metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (length(safe_metadata_json) <= 4000),
  created_at INTEGER NOT NULL,
  UNIQUE (provider_code, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_events_intent_created
  ON marketplace_payment_events(payment_intent_id, created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_payment_events_no_update
BEFORE UPDATE ON marketplace_payment_events
BEGIN
  SELECT RAISE(ABORT, 'PAYMENT_EVENTS_ARE_APPEND_ONLY');
END;

CREATE TRIGGER IF NOT EXISTS trg_payment_events_no_delete
BEFORE DELETE ON marketplace_payment_events
BEGIN
  SELECT RAISE(ABORT, 'PAYMENT_EVENTS_ARE_APPEND_ONLY');
END;
