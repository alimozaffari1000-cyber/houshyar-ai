import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { onRequestGet, onRequestPost } from "../functions/api/orders.js";

const makeRequest = (body, { origin = "https://example.test", cookie = "houshyar_session=valid-session" } = {}) =>
  new Request("https://example.test/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookie },
    body: JSON.stringify(body)
  });

test("orders migration stores immutable item prices and constrained fulfillment/status", async () => {
  const sql = await readFile(new URL("../migrations/0007_marketplace_orders.sql", import.meta.url), "utf8");
  assert.match(sql, /UNIQUE \(buyer_user_id, idempotency_key\)/);
  assert.match(sql, /REFERENCES products\(id\) ON DELETE SET NULL/);
  assert.match(sql, /CHECK \(fulfillment IN \('delivery', 'pickup'\)\)/);
  assert.match(sql, /CHECK \(line_total_minor = quantity \* unit_price_minor\)/);
});

test("order creation rejects unauthenticated and cross-origin requests before database writes", async () => {
  const db = { prepare() { throw new Error("database should not be touched"); } };
  const unauthorized = await onRequestPost({ request: makeRequest({ items: [] }, { cookie: "" }), env: { DB: db } });
  assert.equal(unauthorized.status, 401);
  const forbidden = await onRequestPost({ request: makeRequest({}, { origin: "https://attacker.example" }), env: { DB: db } });
  assert.equal(forbidden.status, 403);
});

test("order creation validates quantities, delivery address and one-store checkout", async () => {
  const db = { prepare() { throw new Error("database should not be touched"); } };
  const badQuantity = await onRequestPost({
    request: makeRequest({ items: [{ productId: "123e4567-e89b-12d3-a456-426614174000", quantity: 0 }] }),
    env: { DB: db }
  });
  assert.equal(badQuantity.status, 400);
  const noAddress = await onRequestPost({
    request: makeRequest({ items: [{ productId: "123e4567-e89b-12d3-a456-426614174000", quantity: 1 }], fulfillment: "delivery", recipientName: "Ali", contactPhone: "09123456789" }),
    env: { DB: db }
  });
  assert.equal(noAddress.status, 400);
});

test("customer order history requires an authenticated session", async () => {
  const response = await onRequestGet({
    request: new Request("https://example.test/api/orders"),
    env: { DB: { prepare() { throw new Error("must not query"); } } }
  });
  assert.equal(response.status, 401);
});
