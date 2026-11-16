import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProviderStatus, providerStatusLabel } from "../src/provider-status.js";

test("provider status accepts only known providers and boolean availability", () => {
  assert.deepEqual(normalizeProviderStatus({
    aiConfigured: true,
    providers: [
      { id: "groq", available: true, defaultModel: "model-a" },
      { id: "openai", available: false },
      { id: "gemini", available: true },
      { id: "unknown-provider", available: true }
    ]
  }), {
    status: "configured",
    providers: {
      groq: { configured: true, defaultModel: "model-a" },
      openai: { configured: false, defaultModel: null },
      gemini: { configured: true, defaultModel: null }
    }
  });
});

test("malformed provider status fails closed", () => {
  assert.deepEqual(normalizeProviderStatus(null), { status: "unknown", providers: {} });
  assert.deepEqual(normalizeProviderStatus({ providers: "invalid" }), { status: "unknown", providers: {} });
});

test("provider labels distinguish configured keys from unknown status", () => {
  const status = normalizeProviderStatus({ aiConfigured: false, providers: [{ id: "groq", available: false }] });
  assert.equal(providerStatusLabel("groq", status, "fa"), "کلید تنظیم نشده");
  assert.equal(providerStatusLabel("openai", status, "fa"), "وضعیت نامشخص");
});

test("Gemini provider status is recognized and clearly labeled", () => {
  const status = normalizeProviderStatus({ aiConfigured: true, providers: [{ id: "gemini", available: true, defaultModel: "gemini-test" }] });
  assert.equal(status.providers.gemini.configured, true);
  assert.equal(status.providers.gemini.defaultModel, "gemini-test");
  assert.equal(providerStatusLabel("gemini", status, "fa"), "کلید تنظیم شده");
});
