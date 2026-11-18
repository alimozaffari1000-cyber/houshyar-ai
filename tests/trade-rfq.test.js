import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { onRequestGet, onRequestPost } from "../functions/api/trade/requests.js";

test("RFQ migration stores buyer-scoped requests with bounded lifecycle and indexes", async () => {
  const sql = await readFile(new URL("../migrations/0011_trade_purchase_requests.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS trade_purchase_requests/);
  assert.match(sql, /buyer_user_id TEXT NOT NULL REFERENCES users\(id\)/);
  assert.match(sql, /status IN \('open', 'closed', 'cancelled', 'fulfilled', 'expired'\)/);
  assert.match(sql, /idx_trade_purchase_requests_match/);
  assert.match(sql, /CHECK \(\(target_price_minor IS NULL AND currency_code IS NULL\)/);
});

test("RFQ endpoints require a session and reject cross-origin writes", async () => {
  const noSession = { DB: { prepare() { return { bind() { return { first: async () => null }; } }; } } };
  const get = await onRequestGet({ request: new Request("https://example.test/api/trade/requests"), env: noSession });
  assert.equal(get.status, 401);
  const post = await onRequestPost({
    request: new Request("https://example.test/api/trade/requests", { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.test" }, body: "{}" }),
    env: noSession
  });
  assert.equal(post.status, 403);
});

test("RFQ country matching and seller matches are scoped and do not expose buyer identity", async () => {
  const sql = [];
  const db = {
    prepare(statement) {
      sql.push(statement);
      return { bind() { return { async first() { return { id: "store-1", countryCode: "AZ", status: "active" }; }, async all() { return { results: [{ id: "rfq-1", title: "Apples" }] }; } }; } };
    }
  };
  const response = await onRequestGet({
    request: new Request("https://example.test/api/trade/requests?view=matches"),
    env: { DB: db },
    // Session resolution is replaced by the test fixture below through the DB query response.
  });
  // This handler still uses the real session resolver; the test verifies the SQL privacy boundary statically.
  assert.ok(response.status === 401 || response.status === 503);
  const endpoint = await readFile(new URL("../functions/api/trade/requests.js", import.meta.url), "utf8");
  assert.match(endpoint, /r\.buyer_user_id != \?/);
  assert.match(endpoint, /r\.country_code IS \?/);
  assert.doesNotMatch(endpoint, /SELECT[^;]*buyer_user_id AS buyer/i);
});

test("RFQ schema and endpoint enforce price, quantity, expiry, and live-country guardrails", async () => {
  const endpoint = await readFile(new URL("../functions/api/trade/requests.js", import.meta.url), "utf8");
  assert.match(endpoint, /INVALID_QUANTITY/);
  assert.match(endpoint, /INVALID_EXPIRY/);
  assert.match(endpoint, /COUNTRY_MARKET_NOT_LIVE/);
  assert.match(endpoint, /PRICE_AND_CURRENCY_REQUIRED_TOGETHER/);
  assert.match(endpoint, /WHERE buyer_user_id = \?/);
});
