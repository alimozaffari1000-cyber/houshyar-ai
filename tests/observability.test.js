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
