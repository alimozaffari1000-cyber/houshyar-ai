import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { onRequestGet, onRequestPost } from "../functions/api/trade/messages.js";

test("negotiation migration scopes threads to one buyer, request and supplier", async () => {
  const sql = await readFile(new URL("../migrations/0013_trade_negotiation_messages.sql", import.meta.url), "utf8");
  assert.match(sql, /UNIQUE\(request_id, supplier_store_id\)/);
  assert.match(sql, /FOREIGN KEY|REFERENCES trade_purchase_requests/);
  assert.match(sql, /REFERENCES merchant_stores/);
  assert.match(sql, /body TEXT NOT NULL CHECK \(length\(body\) BETWEEN 1 AND 2000\)/);
  assert.match(sql, /idx_trade_negotiation_messages_thread/);
});

test("message endpoints require authentication and same-origin writes", async () => {
  const env = { DB: { prepare() { return { bind() { return { first: async () => null }; } }; } } };
  const get = await onRequestGet({ request: new Request("https://example.test/api/trade/messages"), env });
  assert.equal(get.status, 401);
  const post = await onRequestPost({
    request: new Request("https://example.test/api/trade/messages", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://attacker.test" },
      body: "{}"
    }),
    env
  });
  assert.equal(post.status, 403);
});

test("message API enforces participant-only reads and writes", async () => {
  const source = await readFile(new URL("../functions/api/trade/messages.js", import.meta.url), "utf8");
  assert.match(source, /t\.buyer_user_id = \? OR s\.user_id = \?/);
  assert.match(source, /WHERE t\.id = \? AND \(t\.buyer_user_id = \? OR s\.user_id = \?\)/);
  assert.match(source, /THREAD_NOT_FOUND/);
  assert.match(source, /sender_user_id = \?/);
  assert.doesNotMatch(source, /buyerEmail|buyerPhone|supplierEmail|supplierPhone/);
});

test("thread creation requires the buyer to own the RFQ and a current supplier offer", async () => {
  const source = await readFile(new URL("../functions/api/trade/messages.js", import.meta.url), "utf8");
  assert.match(source, /buyer_user_id = \? LIMIT 1/);
  assert.match(source, /o\.request_id = \? AND o\.status = 'submitted'/);
  assert.match(source, /COUNTRY_SCOPE_MISMATCH/);
  assert.match(source, /country_market_configs WHERE country_code = .*status = 'live'/);
  assert.match(source, /INSERT OR IGNORE INTO trade_negotiation_threads/);
  assert.match(source, /THREAD_CLOSED/);
});

test("messages are bounded, rate limited and explicitly not orders or payments", async () => {
  const source = await readFile(new URL("../functions/api/trade/messages.js", import.meta.url), "utf8");
  assert.match(source, /message = text\(body\.message, 2000\)/);
  assert.match(source, /trade-message-create/);
  assert.match(source, /enforceAuthRateLimit/);
  assert.match(source, /do not create an order, contract, reservation, or payment/);
});
