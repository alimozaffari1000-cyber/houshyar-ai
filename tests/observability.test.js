import test from "node:test";
import assert from "node:assert/strict";
import { createRequestTelemetry } from "../functions/api/_lib/observability.js";

test("telemetry emits bounded structured metadata without accepting private content", () => {
  const lines = [];
  let clock = 100;
  const telemetry = createRequestTelemetry({
    request: new Request("https://example.invalid/api/chat"),
    route: "chat",
    now: () => clock,
    logger: { log: line => lines.push(line) }
  });
  clock = 145.4;
  telemetry.log("provider_success", { provider: "google", status: 200, errorCode: "none" });
  const event = JSON.parse(lines[0]);
  assert.equal(event.type, "houshyar_observability");
  assert.equal(event.route, "chat");
  assert.equal(event.provider, "google");
  assert.equal(event.status, 200);
  assert.equal(event.elapsed_ms, 45);
  assert.equal(event.error_code, "none");
  assert.equal(lines[0].includes("example.invalid"), false);
  assert.equal(telemetry.responseHeaders()["Server-Timing"], "app;dur=45");
  assert.ok(telemetry.responseHeaders()["X-Request-ID"]);
});

test("telemetry rejects unsafe event/provider/status/error labels", () => {
  const lines = [];
  const telemetry = createRequestTelemetry({
    request: new Request("https://example.invalid"),
    route: "chat",
    logger: { log: line => lines.push(line) }
  });
  telemetry.log("provider_success", {
    provider: "google-secret-key",
    status: 999,
    errorCode: "prompt contains private text"
  });
  telemetry.log("private_prompt", { provider: "groq", status: 500 });
  const event = JSON.parse(lines[0]);
  assert.equal(lines.length, 1);
  assert.equal(event.provider, "auto");
  assert.equal(event.status, 0);
  assert.equal(event.error_code, "unknown");
  assert.equal(lines[0].includes("private"), false);
});

test("D1 metrics persistence is opt-in and only stores aggregate-safe fields", async () => {
  const writes = [];
  const db = { prepare(sql) { return { bind(...values) { return { run: async () => { writes.push({ sql, values }); } }; } }; } };
  const scheduled = [];
  const telemetry = createRequestTelemetry({
    request: new Request("https://example.invalid"),
    env: { OBSERVABILITY_ENABLED: "true", DB: db },
    ctx: { waitUntil(promise) { scheduled.push(promise); } },
    logger: { log() {} }
  });
  telemetry.log("provider_success", { provider: "groq", status: 200, durationMs: 120 });
  await Promise.all(scheduled);
  assert.equal(writes.length, 2);
  assert.match(writes[0].sql, /INSERT INTO operational_metrics/);
  assert.deepEqual(writes[0].values.slice(1, 5), ["provider_success", "groq", 200, 120]);
  assert.doesNotMatch(writes[0].sql, /prompt|message|user_id|ip_address|token/i);
});
