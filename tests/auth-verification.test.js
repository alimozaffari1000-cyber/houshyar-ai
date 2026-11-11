import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost as verifyEmail } from "../functions/api/auth/verify-email.js";
import { isJsonContentType, readAuthBody } from "../functions/api/_lib/auth-flow.js";

function makeRateLimitedDb(batchResult) {
  return {
    prepare(sql) {
      return { sql, bind(...values) { return { sql, values, async first() { return { request_count: 1 }; } }; } };
    },
    async batch(statements) {
      assert.equal(statements.length, 2);
      assert.match(statements[0].sql, /^UPDATE users SET status = 'active'/);
      assert.match(statements[1].sql, /^UPDATE email_verification_tokens SET consumed_at/);
      return batchResult;
    }
  };
}

test("email verification activates the account and consumes its token atomically", async () => {
  const request = new Request("https://houshyar.example.test/api/auth/verify-email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://houshyar.example.test", "cf-connecting-ip": "192.0.2.20" },
    body: JSON.stringify({ token: "v".repeat(48) })
  });
  const db = makeRateLimitedDb([{ meta: { changes: 1 } }, { meta: { changes: 1 } }]);
  const response = await verifyEmail({ request, env: { AUTH_ENABLED: "true", DB: db } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { verified: true });
});

test("email verification rejects a token when activation or consumption did not occur", async () => {
  const request = new Request("https://houshyar.example.test/api/auth/verify-email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://houshyar.example.test", "cf-connecting-ip": "192.0.2.21" },
    body: JSON.stringify({ token: "z".repeat(48) })
  });
  const db = makeRateLimitedDb([{ meta: { changes: 0 } }, { meta: { changes: 0 } }]);
  const response = await verifyEmail({ request, env: { AUTH_ENABLED: "true", DB: db } });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "INVALID_OR_EXPIRED_TOKEN");
});


test("auth JSON media type accepts parameters but rejects JSON-like suffixes", () => {
  assert.equal(isJsonContentType("application/json"), true);
  assert.equal(isJsonContentType("Application/JSON; charset=utf-8"), true);
  assert.equal(isJsonContentType("application/jsonp"), false);
  assert.equal(isJsonContentType("text/application/json"), false);
  assert.equal(isJsonContentType(null), false);
});

test("auth body parser rejects unsupported JSON-like media types", async () => {
  const request = new Request("https://houshyar.example.test/api/auth/verify-email", {
    method: "POST",
    headers: { "content-type": "application/jsonp" },
    body: JSON.stringify({ token: "x".repeat(48) })
  });
  assert.deepEqual(await readAuthBody(request), { error: "UNSUPPORTED_MEDIA_TYPE", status: 415 });
});
