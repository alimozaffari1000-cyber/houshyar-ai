import test from "node:test";
import assert from "node:assert/strict";
import { checkChatRateLimit } from "../functions/api/_lib/chat-rate-limit.js";
import { onRequestPost } from "../functions/api/chat.js";

function fakeDb(requestCount = 1, failure = false) {
  let captured;
  return {
    prepare(sql) {
      captured = { sql, values: [] };
      return {
        bind(...values) {
          captured.values = values;
          return {
            async first() {
              if (failure) throw new Error("private database error");
              return { request_count: requestCount };
            }
          };
        }
      };
    },
    captured: () => captured
  };
}

const request = () => new Request("https://example.test/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json", "cf-connecting-ip": "203.0.113.10" },
  body: JSON.stringify({ message: "سلام" })
});

test("D1 limiter uses an atomic fixed-window upsert and hashes the client IP", async () => {
  const db = fakeDb(3);
  const result = await checkChatRateLimit({ db, clientIp: "203.0.113.10", now: 125, limit: 2 });
  const query = db.captured();
  assert.ok(query.sql.includes("ON CONFLICT(bucket_key, window_start)"));
  assert.ok(query.sql.includes("request_count = request_count + 1"));
  assert.ok(query.sql.includes("RETURNING request_count"));
  assert.equal(query.values[0].includes("203.0.113.10"), false);
  assert.equal(query.values[1], 120);
  assert.equal(result.allowed, false);
  assert.equal(result.count, 3);
  assert.equal(result.retryAfter, 55);
});

test("rate limit is clamped to a safe supported range", async () => {
  const result = await checkChatRateLimit({ db: fakeDb(1), clientIp: "test", now: 60, limit: 9999 });
  assert.equal(result.limit, 120);
  assert.equal(result.allowed, true);
});

test("enabled limiter fails closed when D1 is not configured", async () => {
  const response = await onRequestPost({ request: request(), env: { GROQ_API_KEY: "test", CHAT_RATE_LIMIT_ENABLED: "true" } });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "RATE_LIMIT_NOT_CONFIGURED");
});

test("over-limit request is rejected before calling the AI provider", async () => {
  const originalFetch = globalThis.fetch;
  let providerCalled = false;
  globalThis.fetch = async () => {
    providerCalled = true;
    return new Response(JSON.stringify({ choices: [{ message: { content: "should not happen" } }] }), { status: 200 });
  };
  try {
    const response = await onRequestPost({
      request: request(),
      env: {
        GROQ_API_KEY: "test",
        CHAT_RATE_LIMIT_ENABLED: "true",
        CHAT_RATE_LIMIT_PER_MINUTE: "2",
        DB: fakeDb(3)
      }
    });
    assert.equal(response.status, 429);
    assert.ok(Number(response.headers.get("Retry-After")) >= 1 && Number(response.headers.get("Retry-After")) <= 60);
    assert.equal((await response.json()).error, "RATE_LIMITED");
    assert.equal(providerCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("D1 failure fails closed without exposing database diagnostics", async () => {
  const response = await onRequestPost({
    request: request(),
    env: { GROQ_API_KEY: "test", CHAT_RATE_LIMIT_ENABLED: "true", DB: fakeDb(0, true) }
  });
  assert.equal(response.status, 503);
  const body = await response.text();
  assert.ok(body.includes("RATE_LIMIT_UNAVAILABLE"));
  assert.equal(body.includes("private database error"), false);
});

test("chat API rate limiting ignores spoofed X-Forwarded-For and uses the Cloudflare client IP", async () => {
  const makeRequest = (cloudflareIp, forwardedFor) => new Request("https://example.test/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "cf-connecting-ip": cloudflareIp,
      "x-forwarded-for": forwardedFor
    },
    body: JSON.stringify({ message: "سلام" })
  });
  const envFor = db => ({
    GROQ_API_KEY: "test",
    CHAT_RATE_LIMIT_ENABLED: "true",
    DB: db
  });

  const firstDb = fakeDb(21);
  const first = await onRequestPost({
    request: makeRequest("203.0.113.10", "198.51.100.10"),
    env: envFor(firstDb)
  });
  const secondDb = fakeDb(21);
  const second = await onRequestPost({
    request: makeRequest("203.0.113.10", "198.51.100.99"),
    env: envFor(secondDb)
  });
  const thirdDb = fakeDb(21);
  const third = await onRequestPost({
    request: makeRequest("203.0.113.11", "198.51.100.10"),
    env: envFor(thirdDb)
  });

  assert.equal(first.status, 429);
  assert.equal(second.status, 429);
  assert.equal(third.status, 429);
  assert.equal(firstDb.captured().values[0], secondDb.captured().values[0]);
  assert.notEqual(firstDb.captured().values[0], thirdDb.captured().values[0]);
});
