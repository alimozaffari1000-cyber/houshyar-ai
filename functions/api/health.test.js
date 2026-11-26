import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "./health.js";

test("health endpoint returns minimal service liveness metadata", async () => {
  const response = await onRequestGet();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(await response.json(), {
    ok: true,
    service: "houshyar-ai",
    coreVersion: "1.0.0"
  });
});

test("health endpoint does not expose runtime configuration or secrets", async () => {
  const response = await onRequestGet();
  const body = await response.text();
  for (const field of ["GROQ_API_KEY", "GEMINI_API_KEY", "CLAUDE_API_KEY", "DEEPSEEK_API_KEY", "DB", "AI"]) {
    assert.equal(body.includes(field), false, `unexpected sensitive field: ${field}`);
  }
});
