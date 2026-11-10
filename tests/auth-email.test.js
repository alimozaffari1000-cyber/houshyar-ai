import test from "node:test";
import assert from "node:assert/strict";
import { createAuthToken, hashAuthToken, authEmailConfig, authEmailLink } from "../functions/api/_lib/auth-email.js";

test("auth tokens are opaque, URL-safe, and sufficiently long", () => {
  const first = createAuthToken();
  const second = createAuthToken();
  assert.match(first, /^[A-Za-z0-9_-]{40,50}$/);
  assert.notEqual(first, second);
});

test("only token hashes are suitable for database storage", async () => {
  const token = createAuthToken();
  const hash = await hashAuthToken(token);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, token);
  assert.equal(await hashAuthToken(token), hash);
});

test("email adapter requires HTTPS endpoint and application origin", () => {
  assert.equal(authEmailConfig({}), null);
  const config = authEmailConfig({
    EMAIL_API_URL: "https://mail.example.test/send",
    EMAIL_API_KEY: "secret",
    EMAIL_FROM: "Houshyar <no-reply@example.test>",
    APP_BASE_URL: "https://houshyar.example.test"
  });
  assert.equal(config.baseUrl, "https://houshyar.example.test");
  assert.equal(authEmailConfig({
    EMAIL_API_URL: "http://mail.example.test/send",
    EMAIL_API_KEY: "secret",
    EMAIL_FROM: "no-reply@example.test",
    APP_BASE_URL: "https://houshyar.example.test"
  }), null);
});

test("auth links include token as a query parameter on the configured origin", () => {
  const url = authEmailLink({
    EMAIL_API_URL: "https://mail.example.test/send",
    EMAIL_API_KEY: "secret",
    EMAIL_FROM: "no-reply@example.test",
    APP_BASE_URL: "https://houshyar.example.test/path"
  }, "verify_email", "opaque-token");
  assert.equal(url, "https://houshyar.example.test/#verify_email=opaque-token");
});

import { onRequestPost as resetPassword } from "../functions/api/auth/reset-password.js";

test("password reset updates the account, consumes its token, and revokes sessions in one D1 batch", async () => {
  const statements = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          const statement = { sql, values };
          statements.push(statement);
          return {
            ...statement,
            async first() { return { request_count: 1 }; }
          };
        }
      };
    },
    async batch(batchStatements) {
      assert.equal(batchStatements.length, 3);
      assert.match(batchStatements[0].sql, /^UPDATE users/);
      assert.match(batchStatements[0].sql, /password_reset_tokens/);
      assert.match(batchStatements[1].sql, /^UPDATE password_reset_tokens/);
      assert.match(batchStatements[2].sql, /^UPDATE sessions/);
      return batchStatements.map(() => ({ meta: { changes: 1 } }));
    }
  };

  const request = new Request("https://houshyar.example.test/api/auth/reset-password", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "origin": "https://houshyar.example.test",
      "cf-connecting-ip": "192.0.2.10"
    },
    body: JSON.stringify({ token: "x".repeat(48), password: "correct horse battery" })
  });
  const response = await resetPassword({ request, env: { AUTH_ENABLED: "true", DB: db } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { passwordReset: true, sessionsRevoked: true });
  assert.equal(statements.length, 3);
});
