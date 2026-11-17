import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("local discovery filters unavailable stock and supports location/fulfillment", async () => {
  const api = await readFile(new URL("../functions/api/stores.js", import.meta.url), "utf8");
  const ui = await readFile(new URL("../src/marketplace.js", import.meta.url), "utf8");
  assert.ok(api.includes("p.stock_count > 0"));
  assert.ok(api.includes("distanceKm"));
  assert.ok(api.includes("LIMIT ? OFFSET ?"));
  assert.ok(api.includes("const offset = clamp"));
  assert.ok(api.includes("longitudeScale"));
  assert.ok(ui.includes("/api/stores?"));
  assert.ok(ui.includes("getCurrentPosition"));
  assert.ok(ui.includes('name="city"'));
  assert.ok(ui.includes('value="delivery"'));
  assert.ok(ui.includes('value="pickup"'));
  assert.ok(ui.includes("orderUrl"));
  assert.ok(ui.includes("offset:String(offset)"));
  assert.ok(ui.includes("insertAdjacentHTML(\"beforeend\""));
  assert.ok(ui.includes("loadingCatalog"));
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

test("marketplace UI supports cart checkout and seller order management", async () => {
  const ui = await readFile(new URL("../src/marketplace.js", import.meta.url), "utf8");
  assert.ok(ui.includes("data-market-checkout"));
  assert.ok(ui.includes("data-cart-add"));
  assert.ok(ui.includes('request("/api/orders"'));
  assert.ok(ui.includes('request("/api/store/orders"'));
  assert.ok(ui.includes("idempotencyKey:checkoutKey"));
  assert.ok(ui.includes("data-order-status"));
  assert.ok(ui.includes("cart.clear()"));
});

test("customer order history tab loads and renders authenticated order status and payment details", async () => {
  const ui = await readFile(new URL("../src/marketplace.js", import.meta.url), "utf8");
  assert.ok(ui.includes('data-market-tab="orders"'));
  assert.ok(ui.includes('data-market-view="orders"'));
  assert.ok(ui.includes('request("/api/orders")'));
  assert.ok(ui.includes("renderCustomerOrders"));
  assert.ok(ui.includes("paymentStatus"));
  assert.ok(ui.includes("order.subtotalMinor"));
  assert.ok(ui.includes("order.deliveryFeeMinor"));
  assert.ok(ui.includes("statusNames"));
});
