-- Country-aware domestic marketplace foundation.
-- Country codes describe a merchant's declared operating market; they do not
-- prove the user's location or establish legal eligibility.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS country_market_configs (
  country_code TEXT PRIMARY KEY CHECK (country_code GLOB '[A-Z][A-Z]'),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 2 AND 100),
  default_locale TEXT NOT NULL CHECK (length(default_locale) BETWEEN 2 AND 35),
  default_currency TEXT NOT NULL CHECK (default_currency GLOB '[A-Z][A-Z][A-Z]'),
  status TEXT NOT NULL DEFAULT 'research'
    CHECK (status IN ('research', 'configuration_draft', 'review', 'staging', 'pilot', 'live', 'suspended')),
  config_version INTEGER NOT NULL DEFAULT 1 CHECK (config_version > 0),
  effective_at INTEGER,
  last_reviewed_at INTEGER,
  reviewer_role TEXT NOT NULL DEFAULT '',
  source_notes TEXT NOT NULL DEFAULT '' CHECK (length(source_notes) <= 2000),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_country_market_configs_status
  ON country_market_configs(status, country_code);

ALTER TABLE merchant_stores ADD COLUMN country_code TEXT
  CHECK (country_code IS NULL OR country_code GLOB '[A-Z][A-Z]');

CREATE INDEX IF NOT EXISTS idx_merchant_stores_country_city_status
  ON merchant_stores(country_code, status, city, region);
