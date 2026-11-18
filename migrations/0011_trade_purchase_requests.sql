-- Buyer request-for-quotation (RFQ) foundation. RFQs are not orders or payments.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS trade_purchase_requests (
  id TEXT PRIMARY KEY,
  buyer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  country_code TEXT CHECK (country_code IS NULL OR country_code GLOB '[A-Z][A-Z]'),
  city TEXT NOT NULL DEFAULT '' CHECK (length(city) <= 80),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 2 AND 160),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 3000),
  category TEXT NOT NULL CHECK (length(category) BETWEEN 1 AND 60),
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 1000000),
  unit TEXT NOT NULL CHECK (length(unit) BETWEEN 1 AND 30),
  target_price_minor INTEGER CHECK (target_price_minor IS NULL OR target_price_minor > 0),
  currency_code TEXT CHECK (currency_code IS NULL OR currency_code GLOB '[A-Z][A-Z][A-Z]'),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'cancelled', 'fulfilled', 'expired')),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK ((target_price_minor IS NULL AND currency_code IS NULL) OR
         (target_price_minor IS NOT NULL AND currency_code IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_trade_purchase_requests_buyer
  ON trade_purchase_requests(buyer_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_purchase_requests_match
  ON trade_purchase_requests(country_code, category, status, expires_at);
