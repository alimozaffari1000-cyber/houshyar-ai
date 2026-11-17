import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet, onRequestPost } from "../functions/api/store/orders.js";
import { onRequestPost as updateOrder } from "../functions/api/store/orders/update.js";

const request = (url, body, cookie = "houshyar_session=valid-session", origin = "https://example.test") => new Request(url, {
  method: body ? "POST" : "GET",
  headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(body ? { Origin: origin } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {})
});

function dbMock({ user = { id: "buyer-1", email: "buyer@example.test", role: "user" }, product = null, batchResults = [{ meta: { changes: 1 } }, { meta: { changes: 1 } }], runResult = { meta: { changes: 1 } } } = {}) {
  const statements = [];
  return {
    statements,
    prepare(sql) {
      const statement = { sql, values: [], bind(...values) { this.values = values; return this; }, async first() {
        if (sql.includes("INSERT INTO api_rate_limits")) return { request_count: 1 };
        if (sql.includes("SELECT users.id")) return user;
        if (sql.includes("FROM products p JOIN merchant_stores")) return product;
        return null;
      }, async all() { return { results: [] }; }, async run() { return runResult; } };
      statements.push(statement);
      return statement;
    },
    async batch(items) { statements.push(...items); return batchResults; }
  };
}

test("order endpoints require an authenticated user", async () => {
  const db = dbMock();
  const response = await onRequestPost({ request: request("https://example.test/api/store/orders", { productId: "123e4567-e89b-12d3-a456-426614174000", fulfillmentMode: "pickup" }, ""), env: { DB: db } });
  assert.equal(response.status, 401);
});

test("buyer can create a pending order without charging or reserving stock", async () => {
  const db = dbMock({ product: { id: "123e4567-e89b-12d3-a456-426614174000", title: "Apple", priceMinor: 120000, currency: "IRR", stockCount: 5, storeId: "store-1", sellerUserId: "seller-1", storeStatus: "active", offersDelivery: 1, offersPickup: 1 } });
  const response = await onRequestPost({ request: request("https://example.test/api/store/orders", { productId: "123e4567-e89b-12d3-a456-426614174000", quantity: 2, fulfillmentMode: "delivery", buyerNote: "Please call first" }), env: { DB: db } });
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.order.status, "pending");
  assert.equal(body.order.quantity, 2);
  const orderWrites = db.statements.filter(statement => /INSERT INTO marketplace_(orders|order_items)/.test(statement.sql));
  assert.equal(orderWrites.length, 2);
  assert.match(orderWrites[0].sql, /INSERT INTO marketplace_orders/);
  assert.match(orderWrites[1].sql, /INSERT INTO marketplace_order_items/);
});

test("buyer cannot order own store product", async () => {
  const db = dbMock({ product: { id: "123e4567-e89b-12d3-a456-426614174000", title: "Apple", priceMinor: 120000, currency: "IRR", stockCount: 5, storeId: "store-1", sellerUserId: "buyer-1", storeStatus: "active", offersDelivery: 1, offersPickup: 1 } });
  const response = await onRequestPost({ request: request("https://example.test/api/store/orders", { productId: "123e4567-e89b-12d3-a456-426614174000", fulfillmentMode: "pickup" }), env: { DB: db } });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "CANNOT_ORDER_OWN_PRODUCT");
});

test("order creation rejects unavailable fulfillment and excessive quantity", async () => {
  const product = { id: "123e4567-e89b-12d3-a456-426614174000", title: "Apple", priceMinor: 120000, currency: "IRR", stockCount: 5, storeId: "store-1", sellerUserId: "seller-1", storeStatus: "active", offersDelivery: 0, offersPickup: 1 };
  const noDelivery = dbMock({ product });
  const first = await onRequestPost({ request: request("https://example.test/api/store/orders", { productId: product.id, fulfillmentMode: "delivery" }), env: { DB: noDelivery } });
  assert.equal(first.status, 400);
  const tooMany = dbMock({ product });
  const second = await onRequestPost({ request: request("https://example.test/api/store/orders", { productId: product.id, quantity: 101, fulfillmentMode: "pickup" }), env: { DB: tooMany } });
  assert.equal(second.status, 400);
});

test("seller acceptance decrements stock only in the same D1 batch as order transition", async () => {
  const db = dbMock();
  const response = await updateOrder({ request: request("https://example.test/api/store/orders/update", { orderId: "123e4567-e89b-12d3-a456-426614174000", action: "accept" }), env: { DB: db } });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "accepted");
  assert.equal(db.statements.length, 2);
  assert.match(db.statements[0].sql, /stock_count = stock_count -/);
  assert.match(db.statements[1].sql, /changes\(\) = 1/);
});

test("failed stock transition leaves the order unaccepted", async () => {
  const db = dbMock({ batchResults: [{ meta: { changes: 0 } }, { meta: { changes: 0 } }] });
  const response = await updateOrder({ request: request("https://example.test/api/store/orders/update", { orderId: "123e4567-e89b-12d3-a456-426614174000", action: "accept" }), env: { DB: db } });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "ORDER_NOT_ACCEPTABLE_OR_STOCK_CHANGED");
});

test("seller cannot complete an order that was not accepted", async () => {
  const db = dbMock({ runResult: { meta: { changes: 0 } } });
  const response = await updateOrder({ request: request("https://example.test/api/store/orders/update", { orderId: "123e4567-e89b-12d3-a456-426614174000", action: "complete" }), env: { DB: db } });
  assert.equal(response.status, 404);
});

test("order writes reject cross-origin requests", async () => {
  const db = dbMock();
  const response = await updateOrder({ request: request("https://example.test/api/store/orders/update", { orderId: "123e4567-e89b-12d3-a456-426614174000", action: "cancel" }, "houshyar_session=valid-session", "https://attacker.example"), env: { DB: db } });
  assert.equal(response.status, 403);
});

test("order list fails closed without a session", async () => {
  const db = dbMock();
  const response = await onRequestGet({ request: request("https://example.test/api/store/orders", null, ""), env: { DB: db } });
  assert.equal(response.status, 401);
});

test("order migration keeps product and currency snapshots and restricts states", async () => {
  const { readFile } = await import("node:fs/promises");
  const sql = await readFile(new URL("../migrations/0007_marketplace_orders.sql", import.meta.url), "utf8");
  assert.match(sql, /CHECK \(status IN \('pending', 'accepted', 'rejected', 'completed', 'cancelled'\)\)/);
  assert.match(sql, /unit_price_minor INTEGER NOT NULL/);
  assert.match(sql, /product_title TEXT NOT NULL/);
  assert.match(sql, /REFERENCES users\(id\) ON DELETE RESTRICT/);
});
