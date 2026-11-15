-- Visual commerce foundation: product imagery and virtual try-on eligibility.
-- Store binary files in a controlled R2 bucket, never in D1.
-- Apply to staging first after reviewing the current remote migration state.
PRAGMA foreign_keys = ON;

ALTER TABLE products ADD COLUMN visual_category TEXT NOT NULL DEFAULT 'other'
  CHECK (visual_category IN (
    'apparel', 'furniture', 'decor', 'lighting', 'electronics', 'other'
  ));

ALTER TABLE products ADD COLUMN virtual_try_on_enabled INTEGER NOT NULL DEFAULT 0
  CHECK (virtual_try_on_enabled IN (0, 1));

CREATE TABLE IF NOT EXISTS product_media (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL
    CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  media_role TEXT NOT NULL DEFAULT 'product'
    CHECK (media_role IN ('product', 'detail', 'lifestyle')),
  alt_text TEXT NOT NULL DEFAULT '',
  width INTEGER NOT NULL CHECK (width BETWEEN 1 AND 12000),
  height INTEGER NOT NULL CHECK (height BETWEEN 1 AND 12000),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 99),
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_media_product_order
  ON product_media(product_id, sort_order, created_at);
