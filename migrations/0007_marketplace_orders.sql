-- Order requests are separate from payments. No money is collected by this migration.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS marketplace_orders (
  id TEXT PRIMARY KEY,
  buyer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  store_id TEXT NOT NULL REFERENCES merchant_stores(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),
  fulfillment_mode TEXT NOT NULL
    CHECK (fulfillment_mode IN ('delivery', 'pickup')),
  buyer_note TEXT NOT NULL DEFAULT '' CHECK (length(buyer_note) <= 500),
  seller_note TEXT NOT NULL DEFAULT '' CHECK (length(seller_note) <= 500),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  accepted_at INTEGER,
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_marketplace_orders_buyer
  ON marketplace_orders(buyer_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_store_status
  ON marketplace_orders(store_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES marketplace_orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_title TEXT NOT NULL,
  unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor > 0),
  currency_code TEXT NOT NULL CHECK (currency_code GLOB '[A-Z][A-Z][A-Z]'),
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 100)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_order_items_order
  ON marketplace_order_items(order_id);
