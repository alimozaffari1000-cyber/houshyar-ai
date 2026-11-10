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
  assert.equal(url, "https://houshyar.example.test/?verify_email=opaque-token");
});
