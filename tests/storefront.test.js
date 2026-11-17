import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { onRequestGet, onRequestPost } from "../functions/api/store/products.js";
import { onRequestPost as applyForStore } from "../functions/api/store/apply.js";
import { onRequestPost as publishProduct } from "../functions/api/store/products/publish.js";
import { onRequestPost as approveStore } from "../functions/api/admin/stores/approve.js";

const req = (url, body, origin = "https://example.test", cookie = "") => new Request(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
  body: JSON.stringify(body)
});

test("marketplace migration isolates merchant stores and product ownership", async () => {
  const sql = await readFile(new URL("../migrations/0004_marketplace_foundation.sql", import.meta.url), "utf8");
  assert.match(sql, /user_id TEXT NOT NULL UNIQUE REFERENCES users/);
  assert.match(sql, /status TEXT NOT NULL DEFAULT 'pending'/);
  assert.match(sql, /REFERENCES merchant_stores\(id\) ON DELETE CASCADE/);
  assert.match(sql, /price_minor INTEGER NOT NULL CHECK \(price_minor > 0\)/);
  assert.match(sql, /UNIQUE\(store_id, slug\)/);
  assert.match(sql, /CHECK \(status IN \('draft', 'published', 'archived'\)\)/);
});

test("public catalog fails closed when D1 is not configured", async () => {
  const response = await onRequestGet({ request: new Request("https://example.test/api/store/products"), env: {} });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "CATALOG_UNAVAILABLE");
});

test("public catalog only queries published products in active stores and caps page size", async () => {
  let sql, bindings;
  const db = { prepare(statement) { sql = statement; return { bind(...values) { bindings = values; return { async all() { return { results: [{ id: "p1" }, { id: "p2" }, { id: "p3" }] }; } }; } }; } };
  const response = await onRequestGet({
    request: new Request("https://example.test/api/store/products?q=shirt&category=fashion&limit=500&offset=0"),
    env: { DB: db }
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.match(sql, /p\.status = 'published'/);
  assert.match(sql, /s\.status = 'active'/);
  assert.match(sql, /JOIN merchant_stores/);
  assert.equal(bindings.at(-2), 51);
  assert.equal(body.products.length, 3);
  assert.equal(body.hasMore, false);
  assert.equal(body.limit, 50);
});

test("seller product creation rejects unauthenticated requests", async () => {
  const response = await onRequestPost({
    request: req("https://example.test/api/store/products", { title: "T-shirt", category: "fashion", priceMinor: 1000 }),
    env: { DB: { prepare() { throw new Error("should not query without a session"); } } }
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "AUTH_REQUIRED");
});

test("merchant application requires a session before writing", async () => {
  const response = await applyForStore({
    request: req("https://example.test/api/store/apply", { name: "Aria", slug: "aria-shop" }),
    env: { DB: { prepare() { throw new Error("should not query without a session"); } } }
  });
  assert.equal(response.status, 401);
});

test("seller publish action requires authentication", async () => {
  const response = await publishProduct({
    request: req("https://example.test/api/store/products/publish", { productId: "123e4567-e89b-12d3-a456-426614174000" }),
    env: { DB: { prepare() { throw new Error("should not query without a session"); } } }
  });
  assert.equal(response.status, 401);
});

test("merchant approval requires an authenticated administrator", async () => {
  const response = await approveStore({
    request: req("https://example.test/api/admin/stores/approve", { storeId: "123e4567-e89b-12d3-a456-426614174000" }),
    env: { DB: { prepare() { throw new Error("should not query without a session"); } } }
  });
  assert.equal(response.status, 401);
});

test("merchant endpoints reject cross-origin requests", async () => {
  const response = await applyForStore({
    request: req("https://example.test/api/store/apply", { name: "Aria", slug: "aria-shop" }, "https://attacker.example"),
    env: { DB: { prepare() { throw new Error("must reject origin before DB"); } } }
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "ORIGIN_NOT_ALLOWED");
});

function authenticatedDb({ user = { id: "user-1", email: "seller@example.test", role: "user" }, store = null, onRun = async () => ({ meta: { changes: 1 } }) } = {}) {
  return {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() {
              if (sql.includes("INSERT INTO api_rate_limits")) return { request_count: 1 };
              if (sql.includes("SELECT users.id")) return user;
              if (sql.includes("SELECT id, status FROM merchant_stores")) return store;
              return null;
            },
            async run() { return onRun(sql, values); }
          };
        }
      };
    },
    async batch(statements) { return Promise.all(statements.map(async statement => statement.run())); }
  };
}

test("authenticated seller cannot create products until store approval", async () => {
  const db = authenticatedDb({ store: { id: "store-1", status: "pending" } });
  const response = await onRequestPost({
    request: req("https://example.test/api/store/products", { title: "Cotton Shirt", category: "fashion", priceMinor: 1250000 }, "https://example.test", "houshyar_session=valid-session"),
    env: { DB: db }
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "STORE_NOT_APPROVED");
});

test("authenticated non-admin cannot approve a merchant store", async () => {
  const db = authenticatedDb({ user: { id: "user-1", email: "seller@example.test", role: "user" } });
  const response = await approveStore({
    request: req("https://example.test/api/admin/stores/approve", { storeId: "123e4567-e89b-12d3-a456-426614174000" }, "https://example.test", "houshyar_session=valid-session"),
    env: { DB: db }
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "ADMIN_REQUIRED");
});

test("approved seller creates a draft product with integer pricing", async () => {
  let insertedSql = "";
  let insertedValues = [];
  const db = authenticatedDb({
    store: { id: "store-1", status: "active" },
    onRun: async (sql, values) => { insertedSql = sql; insertedValues = values; return { meta: { changes: 1 } }; }
  });
  const response = await onRequestPost({
    request: req("https://example.test/api/store/products", { title: "Cotton Shirt", slug: "cotton-shirt", category: "fashion", priceMinor: 1250000, currency: "IRR", stockCount: 4 }, "https://example.test", "houshyar_session=valid-session"),
    env: { DB: db }
  });
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.product.status, "draft");
  assert.equal(body.product.priceMinor, 1250000);
  assert.equal(body.product.currencyExponent, 0);
  assert.match(insertedSql, /'draft'/);
  assert.ok(insertedValues.includes(1250000));
  assert.ok(insertedValues.includes("IRR"));
});
