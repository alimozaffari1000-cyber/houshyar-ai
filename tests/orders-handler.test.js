import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/orders.js";

const PRODUCT_ID = "123e4567-e89b-12d3-a456-426614174000";

function orderDb({ itemChanges = 1, product = {} } = {}) {
  const log = [];
  const selectedProduct = {
    id: PRODUCT_ID,
    storeId: "store-1",
    title: "Test product",
    priceMinor: 2500,
    currency: "EUR",
    stockCount: 4,
    storeStatus: "active",
    offersDelivery: 1,
    offersPickup: 1,
    ...product
  };
  return {
    log,
    prepare(sql) {
      log.push({ sql });
      return {
        bind(...values) {
          return {
            async first() {
              if (sql.includes("SELECT users.id")) {
                return { id: "buyer-1", email: "buyer@example.test", role: "user" };
              }
              if (sql.includes("INSERT INTO api_rate_limits")) return { request_count: 1 };
              if (sql.includes("SELECT p.id, p.store_id")) return selectedProduct;
              return null;
            },
            async run() {
              log[log.length - 1].values = values;
              return { meta: { changes: 1 } };
            }
          };
        }
      };
    },
    async batch(statements) {
      log.push({ batch: statements.length });
      return [{ meta: { changes: 1 } }, { meta: { changes: itemChanges } }];
    }
  };
}

function request(body) {
  return new Request("https://houshyar.example/api/orders", {
    method: "POST",
    headers: {
      Origin: "https://houshyar.example",
      Cookie: "houshyar_session=valid-session-token",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      productId: PRODUCT_ID,
      quantity: 2,
      customerName: "Test Buyer",
      customerPhone: "+49123456789",
      fulfillment: "pickup",
      deliveryAddress: "",
      note: "",
      ...body
    })
  });
}

test("buyer order creation rechecks live product, store, stock and fulfillment in the conditional insert", async () => {
  const DB = orderDb();
  const response = await onRequestPost({ request: request({}), env: { DB } });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.created, true);
  assert.equal(body.order.totalMinor, 5000);
  const itemInsert = DB.log.find(entry => entry.sql?.startsWith("INSERT INTO marketplace_order_items"));
  assert.ok(itemInsert, "order item insert is prepared");
  assert.match(itemInsert.sql, /p\.status = 'published'/);
  assert.match(itemInsert.sql, /s\.status = 'active'/);
  assert.match(itemInsert.sql, /p\.stock_count >= \?/);
  assert.match(itemInsert.sql, /s\.offers_delivery = 1/);
  assert.match(itemInsert.sql, /s\.offers_pickup = 1/);
});

test("buyer order is rejected and parent request cleaned up when availability changes before item insertion", async () => {
  const DB = orderDb({ itemChanges: 0 });
  const response = await onRequestPost({ request: request({}), env: { DB } });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "ORDER_NOT_AVAILABLE");
  const cleanup = DB.log.find(entry => entry.sql?.startsWith("DELETE FROM marketplace_orders"));
  assert.ok(cleanup, "empty parent order is removed after conditional item insert fails");
});

test("buyer order preflight rejects insufficient stock without creating an order", async () => {
  const DB = orderDb({ product: { stockCount: 1 } });
  const response = await onRequestPost({ request: request({ quantity: 2 }), env: { DB } });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "ORDER_NOT_AVAILABLE");
  assert.equal(DB.log.some(entry => entry.batch), false);
});

test("buyer order preflight rejects a suspended store", async () => {
  const DB = orderDb({ product: { storeStatus: "suspended" } });
  const response = await onRequestPost({ request: request({}), env: { DB } });
  assert.equal(response.status, 409);
  assert.equal(DB.log.some(entry => entry.batch), false);
});

test("buyer order rejects fulfillment that the store does not offer", async () => {
  const DB = orderDb({ product: { offersPickup: 0 } });
  const response = await onRequestPost({ request: request({ fulfillment: "pickup" }), env: { DB } });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "ORDER_NOT_AVAILABLE");
  assert.equal(DB.log.some(entry => entry.batch), false);
});

test("buyer order rejects totals that exceed safe integer precision", async () => {
  const DB = orderDb({ product: { priceMinor: Number.MAX_SAFE_INTEGER } });
  const response = await onRequestPost({ request: request({ quantity: 2 }), env: { DB } });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "INVALID_ORDER_TOTAL");
  assert.equal(DB.log.some(entry => entry.batch), false);
});

test("buyer order fails closed when the conditional insert detects a currency or catalog mismatch", async () => {
  const DB = orderDb({ itemChanges: 0 });
  const response = await onRequestPost({ request: request({}), env: { DB } });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "ORDER_NOT_AVAILABLE");
  assert.ok(DB.log.some(entry => entry.sql?.startsWith("DELETE FROM marketplace_orders")));
});
