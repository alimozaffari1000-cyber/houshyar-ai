import test from "node:test";
import assert from "node:assert/strict";
import { listAvailableProviders, resolveProvider, requestModel } from "./model-providers.js";

test("self-hosted provider is hidden until a base URL is configured", () => {
  assert.equal(listAvailableProviders({}).find(item => item.id === "houshyar_local").available, false);
  assert.equal(listAvailableProviders({ HOUSHYAR_MODEL_BASE_URL: "https://llm.example.com" }).find(item => item.id === "houshyar_local").available, true);
});

test("auto routing prefers the configured Houshyar-hosted model", () => {
  const selected = resolveProvider({ HOUSHYAR_MODEL_BASE_URL: "https://llm.example.com" }, "auto", "balanced");
  assert.equal(selected.provider, "houshyar_local");
  assert.equal(selected.model, "houshyar-local");
});

test("self-hosted adapter uses OpenAI-compatible HTTPS endpoint and parses reply", async () => {
  const originalFetch = globalThis.fetch;
  let observed;
  globalThis.fetch = async (url, options) => {
    observed = { url, options };
    return new Response(JSON.stringify({
      model: "qwen2.5:7b",
      choices: [{ message: { content: "سلام، من هوش‌یار هستم." } }],
      usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 }
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const result = await requestModel({
      provider: "houshyar_local",
      env: {
        HOUSHYAR_MODEL_BASE_URL: "https://llm.example.com",
        HOUSHYAR_MODEL_API_KEY: "test-secret",
        HOUSHYAR_MODEL: "qwen2.5:7b"
      },
      messages: [{ role: "user", content: "سلام" }]
    });
    assert.equal(observed.url, "https://llm.example.com/v1/chat/completions");
    assert.equal(observed.options.headers.Authorization, "Bearer test-secret");
    assert.equal(result.reply, "سلام، من هوش‌یار هستم.");
    assert.equal(result.model, "qwen2.5:7b");
    assert.equal(result.usage.totalTokens, 18);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("self-hosted adapter rejects non-HTTPS endpoints", async () => {
  await assert.rejects(
    requestModel({
      provider: "houshyar_local",
      env: { HOUSHYAR_MODEL_BASE_URL: "http://llm.example.com" },
      messages: [{ role: "user", content: "test" }]
    }),
    /invalid_local_model_url/
  );
});
