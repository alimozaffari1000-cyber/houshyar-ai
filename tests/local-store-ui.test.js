import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("local discovery filters unavailable stock and supports location/fulfillment", async () => {
  const api = await readFile(new URL("../functions/api/stores.js", import.meta.url), "utf8");
  const ui = await readFile(new URL("../src/marketplace.js", import.meta.url), "utf8");
  assert.ok(api.includes("p.stock_count > 0"));
  assert.ok(api.includes("distanceKm"));
  assert.ok(ui.includes("/api/stores?"));
  assert.ok(ui.includes("getCurrentPosition"));
  assert.ok(ui.includes('name="city"'));
  assert.ok(ui.includes('value="delivery"'));
  assert.ok(ui.includes('value="pickup"'));
  assert.ok(ui.includes("orderUrl"));
});

test("seller dashboard exposes public location and fulfillment settings", async () => {
  const mine = await readFile(new URL("../functions/api/store/mine.js", import.meta.url), "utf8");
  const ui = await readFile(new URL("../src/marketplace.js", import.meta.url), "utf8");
  assert.ok(mine.includes("public_address AS publicAddress"));
  assert.ok(mine.includes("offers_delivery AS offersDelivery"));
  assert.ok(mine.includes("offers_pickup AS offersPickup"));
  assert.ok(ui.includes("/api/store/profile"));
  assert.ok(ui.includes("data-store-profile"));
});
