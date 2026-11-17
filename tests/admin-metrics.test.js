import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { onRequestGet } from "../functions/api/admin/metrics.js";

function fixture(role = "admin", observability = "true") {
  const token = "metrics-test-session";
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const db = {
    prepare(sql) {
      if (sql.includes("SELECT users.id")) return { bind(hash) { assert.equal(hash, tokenHash); return { first: async () => ({ id: "user-1", role }) }; } };
      if (sql.includes("FROM operational_metrics")) return { bind() { return { all: async () => ({ results: [
        { provider: "groq", event: "provider_success", requests: 8, failures: 0, avg_latency_ms: 450, max_latency_ms: 800 },
        { provider: "google", event: "provider_failure", requests: 2, failures: 2, avg_latency_ms: 900, max_latency_ms: 1200 }
      ] }) }; } };
      throw new Error("Unexpected SQL");
    }
  };
  const request = new Request("https://example.invalid/api/admin/metrics", { headers: { Cookie: "houshyar_session=" + token } });
  return { request, env: { AUTH_ENABLED: "true", OBSERVABILITY_ENABLED: observability, DB: db } };
}

test("admin metrics rejects unauthenticated requests", async () => {
  const response = await onRequestGet({ request: new Request("https://example.invalid"), env: { AUTH_ENABLED: "true", DB: { prepare() { throw new Error("must not query"); } } } });
  assert.equal(response.status, 401);
});

test("admin metrics rejects non-admin users", async () => {
  const { request, env } = fixture("user");
  const response = await onRequestGet({ request, env });
  assert.equal(response.status, 403);
});

test("admin metrics returns only provider aggregates for admins", async () => {
  const { request, env } = fixture();
  const response = await onRequestGet({ request, env });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.totals.requests, 10);
  assert.equal(data.totals.failures, 2);
  assert.equal(data.providers[0].avgLatencyMs, 450);
  assert.equal(JSON.stringify(data).includes("metrics-test-session"), false);
});

test("admin metrics clearly reports disabled collection", async () => {
  const { request, env } = fixture("admin", "false");
  const response = await onRequestGet({ request, env });
  assert.equal((await response.json()).status, "disabled");
});
