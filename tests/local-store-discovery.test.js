import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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
