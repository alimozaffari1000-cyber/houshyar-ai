import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/health/ready.js";

const tables = [
  "users", "sessions", "usage_events", "api_rate_limits", "audit_events",
  "daily_usage", "email_verification_tokens", "password_reset_tokens",
  "merchant_stores", "products"
];

function databaseWith(names) {
  return {
    prepare(sql) {
      assert.match(sql, /sqlite_master/);
      return {
        async all() {
          return { results: names.map(name => ({ name })) };
        }
      };
    }
  };
}

test("readiness reports ready only when AI and the complete database schema are ready", async () => {
  const response = await onRequestGet({
    env: {
      DB: databaseWith(tables),
      GROQ_API_KEY: "configured",
      CLAUDE_API_KEY: "",
      GEMINI_API_KEY: ""
    }
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  const body = await response.json();
  assert.equal(body.status, "ready");
  assert.equal(body.checks.ai.providers.groq, true);
  assert.equal(body.checks.ai.providers.anthropic, false);
  assert.equal(body.checks.database.status, "ready");
  assert.equal(JSON.stringify(body).includes("configured"), false);
});

test("readiness reports degraded when AI providers are not configured", async () => {
  const response = await onRequestGet({ env: { DB: databaseWith(tables) } });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.status, "degraded");
  assert.equal(body.checks.ai.status, "not_configured");
});

test("readiness reports schema pending without exposing table names", async () => {
  const response = await onRequestGet({
    env: { DB: databaseWith(["users"]), GEMINI_API_KEY: "configured" }
  });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.checks.database.status, "schema_pending");
  assert.equal(JSON.stringify(body).includes("password_reset_tokens"), false);
});

test("readiness fails closed when database query throws", async () => {
  const response = await onRequestGet({
    env: {
      DB: { prepare() { return { async all() { throw new Error("private SQL error"); } }; } },
      GROQ_API_KEY: "configured"
    }
  });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.checks.database.status, "unavailable");
  assert.equal(JSON.stringify(body).includes("private SQL error"), false);
});
