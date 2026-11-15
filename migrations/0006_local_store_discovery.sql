-- Local store discovery, public pickup/delivery options and seller-managed location.
-- Store coordinates are business locations, not customer addresses.
-- Apply on staging only after confirming remote migration history.
PRAGMA foreign_keys = ON;

ALTER TABLE merchant_stores ADD COLUMN city TEXT NOT NULL DEFAULT '';
ALTER TABLE merchant_stores ADD COLUMN region TEXT NOT NULL DEFAULT '';
ALTER TABLE merchant_stores ADD COLUMN public_address TEXT NOT NULL DEFAULT '';
ALTER TABLE merchant_stores ADD COLUMN latitude REAL
  CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90);
ALTER TABLE merchant_stores ADD COLUMN longitude REAL
  CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);
ALTER TABLE merchant_stores ADD COLUMN offers_delivery INTEGER NOT NULL DEFAULT 0
  CHECK (offers_delivery IN (0, 1));
ALTER TABLE merchant_stores ADD COLUMN offers_pickup INTEGER NOT NULL DEFAULT 1
  CHECK (offers_pickup IN (0, 1));
ALTER TABLE merchant_stores ADD COLUMN contact_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE merchant_stores ADD COLUMN order_url TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_merchant_stores_city_status
  ON merchant_stores(status, city, region);
