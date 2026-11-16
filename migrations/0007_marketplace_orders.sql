-- Buyer order requests. Requests are not payments; sellers must confirm availability and fulfillment.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS marketplace_orders (
  id TEXT PRIMARY KEY,
  buyer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id TEXT NOT NULL REFERENCES merchant_stores(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL CHECK (length(customer_name) BETWEEN 2 AND 100),
  customer_phone TEXT NOT NULL CHECK (length(customer_phone) BETWEEN 5 AND 30),
  fulfillment TEXT NOT NULL CHECK (fulfillment IN ('delivery', 'pickup')),
  delivery_address TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'accepted', 'rejected', 'completed')),
  total_minor INTEGER NOT NULL CHECK (total_minor > 0),
  currency_code TEXT NOT NULL CHECK (currency_code GLOB '[A-Z][A-Z][A-Z]'),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS marketplace_order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES marketplace_orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_title TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor > 0),
  line_total_minor INTEGER NOT NULL CHECK (line_total_minor > 0)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_orders_buyer
  ON marketplace_orders(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_store
  ON marketplace_orders(store_id, status, created_at DESC);
