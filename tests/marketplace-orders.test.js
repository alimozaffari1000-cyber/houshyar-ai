import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("marketplace order migration stores buyer, fulfillment and immutable item price snapshots", async () => {
  const sql = await readFile(new URL("../migrations/0007_marketplace_orders.sql", import.meta.url), "utf8");
  assert.match(sql, /marketplace_orders/);
  assert.match(sql, /fulfillment IN \('delivery', 'pickup'\)/);
  assert.match(sql, /marketplace_order_items/);
  assert.match(sql, /unit_price_minor/);
  assert.match(sql, /idx_marketplace_orders_store/);
});

test("order endpoint requires same-origin authenticated buyer and validates fulfillment", async () => {
  const source = await readFile(new URL("../functions/api/orders.js", import.meta.url), "utf8");
  assert.match(source, /originAllowed/);
  assert.match(source, /getSessionUser/);
  assert.match(source, /enforceAuthRateLimit/);
  assert.match(source, /INVALID_ORDER_DETAILS/);
  assert.match(source, /ORDER_NOT_AVAILABLE/);
  assert.match(source, /p\.stock_count >= \?/);
  assert.match(source, /s\.offers_delivery = 1/);
  assert.match(source, /s\.offers_pickup = 1/);
  assert.match(source, /env\.DB\.batch/);
  assert.match(source, /status: "requested"/);
});


test("order requests are explicitly not represented as online payments or stock reservations", async () => {
  const ui = await readFile(new URL("../src/marketplace.js", import.meta.url), "utf8");
  const api = await readFile(new URL("../functions/api/orders.js", import.meta.url), "utf8");
  assert.match(ui, /درخواست سفارش پرداخت آنلاین نیست/);
  assert.match(ui, /not online payments and do not reserve stock/);
  assert.match(api, /status: "requested"/);
});


test("order item insert requires the preflight price snapshot to remain unchanged", async () => {
  const source = await readFile(new URL("../functions/api/orders.js", import.meta.url), "utf8");
  assert.match(source, /p\.price_minor = \?/);
  assert.match(source, /item\.product\.priceMinor, item\.product\.currency/);
});
