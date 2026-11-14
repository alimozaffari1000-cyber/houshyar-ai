-- Country-scoped marketplace foundation. All public content is explicitly moderated.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS marketplace_stores (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  country_code TEXT NOT NULL CHECK (country_code IN ('IR','AE','DE','TR')),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 100),
  slug TEXT NOT NULL CHECK (length(slug) BETWEEN 2 AND 120),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 1200),
  city TEXT NOT NULL CHECK (length(city) BETWEEN 2 AND 100),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended','rejected')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(country_code, slug),
  UNIQUE(owner_user_id, country_code, name)
);
CREATE INDEX IF NOT EXISTS idx_market_stores_country_status_city
  ON marketplace_stores(country_code, status, city);

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES marketplace_stores(id) ON DELETE RESTRICT,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  country_code TEXT NOT NULL CHECK (country_code IN ('IR','AE','DE','TR')),
  category TEXT NOT NULL CHECK (category IN ('goods','property','vehicles','jobs','services','fashion')),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 4 AND 120),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 10 AND 3000),
  city TEXT NOT NULL CHECK (length(city) BETWEEN 2 AND 100),
  price_minor INTEGER CHECK (price_minor IS NULL OR price_minor >= 0),
  currency_code TEXT NOT NULL CHECK (currency_code IN ('IRR','AED','EUR','TRY')),
  listing_type TEXT NOT NULL DEFAULT 'offer' CHECK (listing_type IN ('offer','wanted')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','rejected','archived')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_market_listings_country_status_category
  ON marketplace_listings(country_code, status, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_listings_country_city
  ON marketplace_listings(country_code, city, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_listings_store
  ON marketplace_listings(store_id, status, created_at DESC);
