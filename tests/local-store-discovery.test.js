import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";\nimport { onRequestGet as searchStores } from "../functions/api/stores.js";

test("local store migration adds public location and delivery/pickup metadata safely", async () => {
  const sql = await readFile(new URL("../migrations/0006_local_store_discovery.sql", import.meta.url), "utf8");
  assert.match(sql, /ALTER TABLE merchant_stores ADD COLUMN city/);
  assert.match(sql, /latitude REAL[\s\S]*BETWEEN -90 AND 90/);
  assert.match(sql, /longitude REAL[\s\S]*BETWEEN -180 AND 180/);
  assert.match(sql, /offers_delivery INTEGER NOT NULL DEFAULT 0/);
  assert.match(sql, /offers_pickup INTEGER NOT NULL DEFAULT 1/);
  assert.match(sql, /idx_merchant_stores_city_status/);
});

test("public discovery only returns active stores and published products with explicit fulfillment filters", async () => {
  const source = await readFile(new URL("../functions/api/stores.js", import.meta.url), "utf8");
  assert.match(source, /s\.status = 'active'/);
  assert.match(source, /p\.status = 'published'/);
  assert.match(source, /offers_delivery = 1/);
  assert.match(source, /offers_pickup = 1/);
  assert.match(source, /INVALID_COORDINATES/);
  assert.match(source, /distanceKm/);
});

test("store profile changes require an authenticated owner and HTTPS order links", async () => {
  const source = await readFile(new URL("../functions/api/store/profile.js", import.meta.url), "utf8");
  assert.match(source, /getSessionUser/);
  assert.match(source, /originAllowed/);
  assert.match(source, /WHERE id = \? AND user_id = \?/);
  assert.match(source, /ORDER_URL_MUST_USE_HTTPS/);
  assert.match(source, /INVALID_STORE_COORDINATES/);
});

\ntest("public discovery filters delivery and paginates the sorted candidate set", async () => {
  let sql = "", bindings = [];
  const DB = { prepare(statement) { sql = statement; return { bind(...values) { bindings = values; return { async all() { return { results: [
    { productId:"far", title:"Apple", latitude:40.8, longitude:49.8, updatedAt:3 },
    { productId:"near", title:"Apple", latitude:40.7, longitude:49.9, updatedAt:2 },
    { productId:"unknown", title:"Apple", latitude:null, longitude:null, updatedAt:1 }
  ] }; } }; } }; } };
  const response = await searchStores({ request:new Request("https://example.test/api/stores?q=apple&mode=delivery&lat=40.7&lon=49.9&limit=1&offset=0"), env:{ DB } });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.match(sql, /s.offers_delivery = 1/);
  assert.equal(bindings.at(-1), 501);
  assert.equal(body.products[0].productId, "near");
  assert.equal(body.products[0].distanceKm, 0);
  assert.equal(body.hasMore, true);
  assert.equal(body.locationUsedForThisSearch, true);
});

test("public discovery rejects partial or out-of-range coordinates", async () => {
  const response = await searchStores({ request:new Request("https://example.test/api/stores?lat=91&lon=0"), env:{ DB:{ prepare(){ throw new Error("must reject invalid coordinates"); } } } });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "INVALID_COORDINATES");
});
