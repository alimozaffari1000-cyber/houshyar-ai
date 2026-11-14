PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS marketplace_images (
 id TEXT PRIMARY KEY,
 store_id TEXT NOT NULL REFERENCES marketplace_stores(id) ON DELETE RESTRICT,
 owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 country_code TEXT NOT NULL CHECK (country_code IN ('IR','AE','DE','TR')),
 object_key TEXT NOT NULL UNIQUE,
 content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg','image/png','image/webp')),
 byte_size INTEGER NOT NULL CHECK (byte_size BETWEEN 1 AND 5242880),
 status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','deleted')),
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_market_images_owner_store ON marketplace_images(owner_user_id, store_id, status);
CREATE TABLE IF NOT EXISTS marketplace_listing_images (
 listing_id TEXT NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
 image_id TEXT NOT NULL REFERENCES marketplace_images(id) ON DELETE RESTRICT,
 sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 5),
 PRIMARY KEY (listing_id, image_id),
 UNIQUE (listing_id, sort_order)
);
CREATE INDEX IF NOT EXISTS idx_market_listing_images_image ON marketplace_listing_images(image_id);
