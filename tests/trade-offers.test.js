import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { onRequestGet, onRequestPost } from "../functions/api/trade/offers.js";

test("supplier offer migration is versioned and bounded", async () => {
  const sql = await readFile(new URL("../migrations/0012_trade_supplier_offers.sql", import.meta.url), "utf8");
  assert.match(sql, /UNIQUE\(request_id, supplier_store_id, revision\)/);
  assert.match(sql, /status IN \('submitted', 'superseded', 'withdrawn'\)/);
  assert.match(sql, /unit_price_minor INTEGER NOT NULL CHECK \(unit_price_minor > 0\)/);
  assert.match(sql, /idx_trade_supplier_offers_request/);
});

test("offer endpoints require authentication and same-origin writes", async () => {
  const env = { DB: { prepare() { return { bind() { return { first: async () => null }; } }; } } };
  const get = await onRequestGet({ request: new Request("https://example.test/api/trade/offers"), env });
  assert.equal(get.status, 401);
  const post = await onRequestPost({
    request: new Request("https://example.test/api/trade/offers", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://attacker.test" },
      body: "{}"
    }),
    env
  });
  assert.equal(post.status, 403);
});

test("offer API enforces buyer ownership, seller eligibility and country scope", async () => {
  const source = await readFile(new URL("../functions/api/trade/offers.js", import.meta.url), "utf8");
  assert.match(source, /buyer_user_id = \?/);
  assert.match(source, /supplier_store_id = \?/);
  assert.match(source, /rfq\.supplierVisible/);
  assert.match(source, /rfq\.countryCode !== \(store\.countryCode \?\? null\)/);
  assert.match(source, /cm\.status = 'live'/);
  assert.match(source, /p\.status = 'published'/);
  assert.match(source, /status = 'superseded'/);
  assert.match(source, /BUYER_CANNOT_OFFER_ON_OWN_REQUEST/);
  assert.doesNotMatch(source, /buyerEmail|buyerPhone|buyerUserId AS/);
});

test("offer input limits and currency checks are present", async () => {
  const source = await readFile(new URL("../functions/api/trade/offers.js", import.meta.url), "utf8");
  assert.match(source, /INVALID_UNIT_PRICE/);
  assert.match(source, /INVALID_MINIMUM_QUANTITY/);
  assert.match(source, /INVALID_LEAD_TIME/);
  assert.match(source, /OFFER_CURRENCY_MISMATCH/);
  assert.match(source, /PUBLISHED_MATCHING_PRODUCT_REQUIRED/);
});
