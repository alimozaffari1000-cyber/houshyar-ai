import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("country market migration adds reviewed country configuration and optional merchant scope", async () => {
  const sql = await readFile(new URL("../migrations/0008_country_market_foundation.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS country_market_configs/);
  assert.match(sql, /country_code TEXT PRIMARY KEY CHECK \(country_code GLOB '\[A-Z\]\[A-Z\]'\)/);
  assert.match(sql, /status IN \('research', 'configuration_draft', 'review', 'staging', 'pilot', 'live', 'suspended'\)/);
  assert.match(sql, /ALTER TABLE merchant_stores ADD COLUMN country_code TEXT/);
  assert.match(sql, /country_code IS NULL OR country_code GLOB/);
  assert.match(sql, /idx_merchant_stores_country_city_status/);
  assert.doesNotMatch(sql, /INSERT INTO country_market_configs/i);
});

test("country configuration does not claim that a country is live by default", async () => {
  const sql = await readFile(new URL("../migrations/0008_country_market_foundation.sql", import.meta.url), "utf8");
  assert.match(sql, /status TEXT NOT NULL DEFAULT 'research'/);
  assert.doesNotMatch(sql, /DEFAULT 'live'/);
});
