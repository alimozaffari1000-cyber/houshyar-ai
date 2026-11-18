import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { onRequestGet } from "../functions/api/admin/health.js";

const tables = [
  "users", "sessions", "usage_events", "api_rate_limits", "audit_events",
  "daily_usage", "email_verification_tokens", "password_reset_tokens",
  "merchant_stores", "products", "operational_metrics", "agent_tasks"
];

async function fixture(role = "admin") {
  const token = "unit-test-session-token";
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const db = {
    prepare(sql) {
      if (sql.includes("SELECT users.id")) {
        return { bind(...values) { assert.equal(values[0], tokenHash); assert.equal(typeof values[1], "number"); return { async first() {
          return { id: "user-1", email: "admin@example.invalid", role };
        } }; } };
      }
      if (sql.includes("sqlite_master")) {
        return { async all() { return { results: tables.map(name => ({ name })) }; } };
      }
      throw new Error("Unexpected SQL");
    }
  };
  const request = new Request("https://example.invalid/api/admin/health", {
    headers: { Cookie: "houshyar_session=" + token }
  });
  return { env: { AUTH_ENABLED: "true", DB: db, GROQ_API_KEY: "test-provider-secret" }, request };
}

test("admin health endpoint rejects unauthenticated requests", async () => {
  const response = await onRequestGet({
    request: new Request("https://example.invalid/api/admin/health"),
    env: { AUTH_ENABLED: "true", DB: { prepare() { throw new Error("must not query"); } } }
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "AUTH_REQUIRED" });
});

test("admin health endpoint rejects authenticated non-admin users", async () => {
  const { env, request } = await fixture("user");
  const response = await onRequestGet({ request, env });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "ADMIN_REQUIRED" });
});

test("admin health endpoint returns readiness without secrets for admins", async () => {
  const { env, request } = await fixture("admin");
  const response = await onRequestGet({ request, env });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, "ready");
  assert.equal(body.checks.database.status, "ready");
  assert.equal(JSON.stringify(body).includes("test-provider-secret"), false);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});
