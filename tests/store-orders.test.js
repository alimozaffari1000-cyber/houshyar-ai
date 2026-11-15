import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("seller order endpoint scopes reads and status updates to the authenticated active store", async () => {
  const source = await readFile(new URL("../functions/api/store/orders.js", import.meta.url), "utf8");
  assert.match(source, /getSessionUser/);
  assert.match(source, /originAllowed/);
  assert.match(source, /WHERE o\.store_id = \?/);
  assert.match(source, /WHERE id = \? AND store_id = \? AND status = \?/);
  assert.match(source, /\["accepted", "rejected", "completed"\]/);
  assert.match(source, /ORDER_STATUS_CONFLICT/);
});


import { createHash } from "node:crypto";
import { onRequestGet, onRequestPatch } from "../functions/api/store/orders.js";

async function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}
function ordersDb({ store = { id: "store-1" }, updateChanges = 1, rows = [] } = {}) {
  const sqlLog = [];
  return {
    sqlLog,
    prepare(sql) {
      sqlLog.push(sql);
      return {
        bind(...values) {
          return {
            async first() {
              if (sql.includes("SELECT users.id")) return { id: "seller-1", email: "seller@example.test", role: "user" };
              if (sql.includes("SELECT id FROM merchant_stores")) return store;
              if (sql.includes("INSERT INTO api_rate_limits")) return { request_count: 1 };
              return null;
            },
            async all() { return { results: rows }; },
            async run() { return { meta: { changes: updateChanges }, values }; }
          };
        }
      };
    }
  };
}
function sellerRequest(path, method = "GET", body) {
  return new Request("https://example.test" + path, {
    method,
    headers: {
      Origin: "https://example.test",
      Cookie: "houshyar_session=valid-session-token",
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
}

test("seller can read only orders belonging to their active store", async () => {
  const DB = ordersDb({ rows: [{ id: "order-1", status: "requested", productTitle: "Shoes" }] });
  const response = await onRequestGet({ request: sellerRequest("/api/store/orders"), env: { DB } });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.orders[0].id, "order-1");
  assert.match(DB.sqlLog.find(sql => sql.includes("FROM marketplace_orders")), /WHERE o\.store_id = \?/);
});

test("seller order listing requires an authenticated session", async () => {
  const DB = { prepare() { throw new Error("database must not be queried"); } };
  const response = await onRequestGet({ request: new Request("https://example.test/api/store/orders"), env: { DB } });
  assert.equal(response.status, 401);
});

test("seller order update rejects cross-origin requests", async () => {
  const DB = { prepare() { throw new Error("database must not be queried"); } };
  const request = new Request("https://example.test/api/store/orders", {
    method: "PATCH",
    headers: { Origin: "https://attacker.example" },
    body: JSON.stringify({ orderId: "123e4567-e89b-12d3-a456-426614174000", status: "accepted" })
  });
  const response = await onRequestPatch({ request, env: { DB } });
  assert.equal(response.status, 403);
});

test("seller can accept a requested order in their own active store", async () => {
  const DB = ordersDb();
  const response = await onRequestPatch({
    request: sellerRequest("/api/store/orders", "PATCH", { orderId: "123e4567-e89b-12d3-a456-426614174000", status: "accepted" }),
    env: { DB }
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).updated, true);
  const update = DB.sqlLog.find(sql => sql.startsWith("UPDATE marketplace_orders"));
  assert.match(update, /WHERE id = \? AND store_id = \? AND status = \?/);
});

test("seller cannot complete an order before accepting it", async () => {
  const DB = ordersDb({ updateChanges: 0 });
  const response = await onRequestPatch({
    request: sellerRequest("/api/store/orders", "PATCH", { orderId: "123e4567-e89b-12d3-a456-426614174000", status: "completed" }),
    env: { DB }
  });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "ORDER_STATUS_CONFLICT");
});

test("seller cannot update orders after their store is suspended", async () => {
  const DB = ordersDb({ store: null });
  const response = await onRequestPatch({
    request: sellerRequest("/api/store/orders", "PATCH", { orderId: "123e4567-e89b-12d3-a456-426614174000", status: "rejected" }),
    env: { DB }
  });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "STORE_NOT_FOUND");
});

test("seller order update rejects unknown lifecycle states", async () => {
  const DB = ordersDb();
  const response = await onRequestPatch({
    request: sellerRequest("/api/store/orders", "PATCH", { orderId: "123e4567-e89b-12d3-a456-426614174000", status: "paid" }),
    env: { DB }
  });
  assert.equal(response.status, 400);
});
