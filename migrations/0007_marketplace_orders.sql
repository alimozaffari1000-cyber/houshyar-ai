-- Marketplace orders with immutable purchase snapshots.
-- Prepare and validate on staging; do not apply remotely as part of this change.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  store_id TEXT NOT NULL REFERENCES merchant_stores(id) ON DELETE RESTRICT,
  buyer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  fulfillment TEXT NOT NULL CHECK (fulfillment IN ('delivery', 'pickup')),
  recipient_name TEXT NOT NULL CHECK (length(recipient_name) BETWEEN 2 AND 100),
  contact_phone TEXT NOT NULL CHECK (length(contact_phone) BETWEEN 6 AND 30),
  delivery_address TEXT NOT NULL DEFAULT '',
  buyer_note TEXT NOT NULL DEFAULT '',
  currency_code TEXT NOT NULL CHECK (currency_code GLOB '[A-Z][A-Z][A-Z]'),
  subtotal_minor INTEGER NOT NULL CHECK (subtotal_minor > 0),
  delivery_fee_minor INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_minor >= 0),
  total_minor INTEGER NOT NULL CHECK (total_minor = subtotal_minor + delivery_fee_minor),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'shipped', 'completed', 'cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'refunded')),
  idempotency_key TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (buyer_user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer_created
  ON orders(buyer_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_store_status_created
  ON orders(store_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  product_title TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 100),
  unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor > 0),
  line_total_minor INTEGER NOT NULL CHECK (line_total_minor = quantity * unit_price_minor),
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order
  ON order_items(order_id);
