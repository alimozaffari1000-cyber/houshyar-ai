-- Marketplace foundation. Prepare and validate on staging before any remote apply.
-- Monetary values are stored as integer currency minor units; never use floating point.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS merchant_stores (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 100),
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_merchant_stores_status_created
  ON merchant_stores(status, created_at);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES merchant_stores(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 2 AND 160),
  slug TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  price_minor INTEGER NOT NULL CHECK (price_minor > 0),
  currency_code TEXT NOT NULL CHECK (currency_code GLOB '[A-Z][A-Z][A-Z]'),
  stock_count INTEGER NOT NULL DEFAULT 0 CHECK (stock_count >= 0),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(store_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_products_public_catalog
  ON products(status, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_store_status
  ON products(store_id, status, updated_at DESC);
