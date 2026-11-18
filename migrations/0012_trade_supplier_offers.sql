-- Versioned supplier offers. This is a negotiation record, not an order or payment.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS trade_supplier_offers (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES trade_purchase_requests(id) ON DELETE CASCADE,
  supplier_store_id TEXT NOT NULL REFERENCES merchant_stores(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor > 0),
  currency_code TEXT NOT NULL CHECK (currency_code GLOB '[A-Z][A-Z][A-Z]'),
  minimum_quantity INTEGER NOT NULL DEFAULT 1 CHECK (minimum_quantity BETWEEN 1 AND 1000000),
  lead_time_days INTEGER NOT NULL DEFAULT 0 CHECK (lead_time_days BETWEEN 0 AND 365),
  delivery_terms TEXT NOT NULL DEFAULT '' CHECK (length(delivery_terms) <= 500),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 1000),
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'superseded', 'withdrawn')),
  created_at INTEGER NOT NULL,
  UNIQUE(request_id, supplier_store_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_trade_supplier_offers_request
  ON trade_supplier_offers(request_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_supplier_offers_store
  ON trade_supplier_offers(supplier_store_id, created_at DESC);
