import test from "node:test";
import assert from "node:assert/strict";
import { dailyQuotaLimit, reserveDailyChat, releaseDailyChat } from "../functions/api/_lib/daily-quota.js";

test("daily quota defaults and clamps configuration", () => {
  assert.equal(dailyQuotaLimit(undefined), 20);
  assert.equal(dailyQuotaLimit("0"), 1);
  assert.equal(dailyQuotaLimit("900"), 500);
  assert.equal(dailyQuotaLimit("bad"), 20);
});

test("reservation is an atomic conditional upsert", async () => {
  let sql = ""; let args = [];
  const db = { prepare(query) { sql = query; return { bind(...values) { args = values; return { first: async () => ({ request_count: 3 }) }; } }; } };
  const result = await reserveDailyChat({ db, userId: "u1", limit: 20, now: 1794268800 });
  assert.match(sql, /ON CONFLICT/);
  assert.match(sql, /RETURNING request_count/);
  assert.equal(args[0], "u1");
  assert.equal(args[3], 20);
  assert.equal(result.allowed, true);
  assert.equal(result.used, 3);
});

test("no returned row means quota exhausted", async () => {
  const db = { prepare() { return { bind() { return { first: async () => null }; } }; } };
  const result = await reserveDailyChat({ db, userId: "u1", limit: 1, now: 1794268800 });
  assert.equal(result.allowed, false);
});

test("failed provider requests can release reservations", async () => {
  let sql = ""; let args = [];
  const db = { prepare(query) { sql = query; return { bind(...values) { args = values; return { run: async () => ({ success: true }) }; } }; } };
  await releaseDailyChat({ db, userId: "u1", now: 1794268800 });
  assert.match(sql, /request_count - 1/);
  assert.equal(args[1], "u1");
});
