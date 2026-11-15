import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/orders.js";

function buyerDb({ user = { id: "buyer-1", email: "buyer@example.test", role: "user" }, rows = [] } = {}) {
  const statements = [];
  return {
    statements,
    prepare(sql) {
      statements.push(sql);
      return {
        bind(...values) {
          return {
            async first() {
              if (sql.includes("SELECT users.id")) return user;
              return null;
            },
            async all() { return { results: rows }; }
          };
        }
      };
    }
  };
}
const request = () => new Request("https://example.test/api/orders", {
  headers: { Cookie: "houshyar_session=valid-session-token" }
});

test("buyer order history requires an authenticated session", async () => {
  const DB = buyerDb({ user: null });
  const response = await onRequestGet({ request: request(), env: { DB } });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "AUTH_REQUIRED");
  assert.equal(DB.statements.length, 1);
});

test("buyer order history is scoped to the authenticated buyer and returns status snapshots", async () => {
  const DB = buyerDb({ rows: [{ id: "order-1", status: "accepted", productTitle: "Shoes", quantity: 1 }] });
  const response = await onRequestGet({ request: request(), env: { DB } });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.orders[0].status, "accepted");
  assert.match(DB.statements[1], /WHERE o\.buyer_id = \?/);
  assert.match(DB.statements[1], /ORDER BY o\.created_at DESC LIMIT 100/);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("buyer order history fails closed when D1 is unavailable", async () => {
  const response = await onRequestGet({ request: request(), env: {} });
  assert.equal(response.status, 503);
});
