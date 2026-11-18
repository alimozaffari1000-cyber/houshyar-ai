import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/health.js";

test("health endpoint returns a minimal no-store status response", async () => {
  const response = await onRequestGet({
    env: { CF_PAGES_COMMIT_SHA: "abc123", GROQ_API_KEY: "never-expose-this" }
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  const body = await response.json();
  assert.equal(body.status, "ok");
  assert.equal(body.service, "houshyar-ai");
  assert.equal(body.version, "abc123");
  assert.ok(Number.isFinite(Date.parse(body.timestamp)));
  assert.equal(JSON.stringify(body).includes("never-expose-this"), false);
});

test("health endpoint uses a safe fallback for absent or malformed version metadata", async () => {
  const missing = await (await onRequestGet({ env: {} })).json();
  const malformed = await (await onRequestGet({ env: { APP_VERSION: "secret value" } })).json();
  assert.equal(missing.version, "unknown");
  assert.equal(malformed.version, "unknown");
});
