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

import { onRequestGet as searchStores } from "../functions/api/stores.js";
import { onRequestGet as searchProducts } from "../functions/api/store/products.js";

function catalogDb(rows = []) {
  let sql = "";
  let bindings = [];
  return {
    get sql() { return sql; },
    get bindings() { return bindings; },
    prepare(statement) {
      sql = statement;
      return { bind(...values) { bindings = values; return { async all() { return { results: rows }; } }; } };
    }
  };
}

test("domestic store discovery is restricted to the requested live country market", async () => {
  const db = catalogDb([{ productId: "p1", countryCode: "AZ" }]);
  const response = await searchStores({
    request: new Request("https://example.test/api/stores?country=az&city=Baku"),
    env: { DB: db }
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.match(db.sql, /s\.country_code = \?/);
  assert.match(db.sql, /country_market_configs cm/);
  assert.match(db.sql, /cm\.status = 'live'/);
  assert.ok(db.bindings.includes("AZ"));
  assert.equal(body.products[0].countryCode, "AZ");
});

test("domestic product catalog applies the same live-country gate", async () => {
  const db = catalogDb([{ id: "p1", countryCode: "IR" }]);
  const response = await searchProducts({
    request: new Request("https://example.test/api/store/products?country=ir"),
    env: { DB: db }
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.match(db.sql, /s\.country_code = \?/);
  assert.match(db.sql, /country_market_configs cm/);
  assert.match(db.sql, /cm\.status = 'live'/);
  assert.ok(db.bindings.includes("IR"));
});

test("country-aware discovery rejects malformed country codes before querying D1", async () => {
  for (const handler of [searchStores, searchProducts]) {
    const response = await handler({
      request: new Request("https://example.test/api/catalog?country=IRN"),
      env: { DB: { prepare() { throw new Error("must reject invalid country"); } } }
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "INVALID_COUNTRY_CODE");
  }
});

test("merchant onboarding and profile APIs accept only two-letter country codes", async () => {
  const apply = await readFile(new URL("../functions/api/store/apply.js", import.meta.url), "utf8");
  const profile = await readFile(new URL("../functions/api/store/profile.js", import.meta.url), "utf8");
  assert.match(apply, /countryCode/);
  assert.match(apply, /INVALID_COUNTRY_CODE/);
  assert.match(profile, /country_code AS countryCode/);
  assert.match(profile, /country_code = \?/);
  assert.match(profile, /WHERE id = \? AND user_id = \?/);
});
