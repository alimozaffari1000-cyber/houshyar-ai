import test from "node:test";
import assert from "node:assert/strict";
import { createPasswordRecord, verifyPassword, normalizeEmail, validEmail, sessionCookie, parseCookie, originAllowed, createSession, getSessionUser } from "../functions/api/_lib/auth.js";
import { onRequestPost as register } from "../functions/api/auth/register.js";
import { onRequestPost as login } from "../functions/api/auth/login.js";

test("normalizes and validates email addresses", () => {
  assert.equal(normalizeEmail("  USER@Example.com "), "user@example.com");
  assert.equal(validEmail("user@example.com"), true);
  assert.equal(validEmail("not-an-email"), false);
});

test("password record uses a unique salt and verifies only the matching password", async () => {
  const first = await createPasswordRecord("a-long-test-password-123");
  const second = await createPasswordRecord("a-long-test-password-123");
  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.hash, second.hash);
  assert.equal(await verifyPassword("a-long-test-password-123", first.salt, first.hash, first.iterations), true);
  assert.equal(await verifyPassword("incorrect-password", first.salt, first.hash, first.iterations), false);
});

test("session cookie is HttpOnly, Secure and SameSite Lax", () => {
  const cookie = sessionCookie("opaque-token");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Path=\//);
});

test("cookie parser reads the session cookie", () => {
  const request = new Request("https://example.test", { headers: { cookie: "other=x; houshyar_session=abc123" } });
  assert.equal(parseCookie(request, "houshyar_session"), "abc123");
});

test("origin check rejects cross-origin state changes", () => {
  assert.equal(originAllowed(new Request("https://example.test/api/auth/login", { headers: { origin: "https://evil.test" } })), false);
  assert.equal(originAllowed(new Request("https://example.test/api/auth/login", { headers: { origin: "https://example.test" } })), true);
});

test("session creation stores only a token hash", async () => {
  let sql = ""; let values = [];
  const db = { prepare(query) { sql = query; return { bind(...args) { values = args; return { run: async () => ({ success: true }) }; } }; } };
  const session = await createSession(db, "user-1", 1000);
  assert.match(sql, /INSERT INTO sessions/);
  assert.equal(values[1], "user-1");
  assert.notEqual(values[2], session.token);
  assert.equal(session.expiresAt, 1000 + 30 * 86400);
});

test("session lookup returns null without a cookie", async () => {
  const db = { prepare() { throw new Error("must not query"); } };
  assert.equal(await getSessionUser(db, new Request("https://example.test")), null);
});

test("registration remains disabled until explicitly configured", async () => {
  const response = await register({ request: new Request("https://example.test/api/auth/register", { method: "POST" }), env: {} });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "AUTH_NOT_CONFIGURED");
});

test("login remains disabled until explicitly configured", async () => {
  const response = await login({ request: new Request("https://example.test/api/auth/login", { method: "POST" }), env: {} });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "AUTH_NOT_CONFIGURED");
});

test("session lookup is scoped to one hashed session and an active owning account", async () => {
  let sql = ""; let values = [];
  const db = { prepare(query) { sql = query; return { bind(...args) { values = args; return { first: async () => ({ id: "user-1", email: "user@example.test", role: "user" }) }; } }; } };
  const request = new Request("https://example.test/api/auth/me", { headers: { cookie: "houshyar_session=opaque-session-token" } });
  const user = await getSessionUser(db, request, 1000);
  assert.equal(user.id, "user-1");
  assert.match(sql, /sessions\.token_hash = \?/);
  assert.match(sql, /sessions\.user_id/);
  assert.match(sql, /sessions\.revoked_at IS NULL/);
  assert.match(sql, /sessions\.expires_at > \?/);
  assert.match(sql, /users\.status = 'active'/);
  assert.equal(values.length, 2);
  assert.notEqual(values[0], "opaque-session-token");
  assert.equal(values[1], 1000);
});
