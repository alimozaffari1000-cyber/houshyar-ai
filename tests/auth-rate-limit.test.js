import test from "node:test";
import assert from "node:assert/strict";
import { checkAuthRateLimit } from "../functions/api/_lib/auth-rate-limit.js";

test("auth limiter hashes identifiers and applies a per-action threshold", async () => {
  const statements = [];
  const db = { prepare(sql) { return { bind(...args) { statements.push({ sql, args }); return { first: async () => ({ request_count: 2 }) }; } }; } };
  const result = await checkAuthRateLimit({ db, action: "login", email: "USER@example.com", clientIp: "203.0.113.10", now: 1800000000, limit: 10 });
  assert.equal(result.allowed, true);
  assert.equal(result.limit, 10);
  assert.equal(statements.length, 2);
  assert.ok(statements.every(item => item.args[0].startsWith("auth:login:")));
  assert.ok(statements.every(item => !item.args[0].includes("USER@example.com")));
});

test("auth limiter rejects when either IP or email bucket exceeds the limit", async () => {
  let call = 0;
  const db = { prepare() { return { bind() { call += 1; return { first: async () => ({ request_count: call === 1 ? 1 : 6 }) }; } }; } };
  const result = await checkAuthRateLimit({ db, action: "register", email: "a@b.com", clientIp: "198.51.100.2", now: 1800000000, limit: 5 });
  assert.equal(result.allowed, false);
});

test("auth limiter fails closed without D1", async () => {
  await assert.rejects(() => checkAuthRateLimit({ db: null, action: "login", email: "a@b.com", clientIp: "unknown" }));
});
