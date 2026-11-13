import test from "node:test";
import assert from "node:assert/strict";
import { listAvailableProviders, resolveProvider, requestModel } from "../functions/api/_lib/model-providers.js";

test("provider availability reflects server-side secrets only", () => {
  assert.deepEqual(listAvailableProviders({ GROQ_API_KEY: "g" }).map(item => [item.id, item.available]), [
    ["groq", true], ["anthropic", false]
  ]);
  assert.equal(resolveProvider({ CLAUDE_API_KEY: "c" }, "auto", "balanced").provider, "anthropic");
});

test("deep auto mode selects Claude when configured", () => {
  assert.equal(resolveProvider({ GROQ_API_KEY: "g", CLAUDE_API_KEY: "c" }, "auto", "deep").provider, "anthropic");
  assert.equal(resolveProvider({ GROQ_API_KEY: "g" }, "auto", "deep").provider, "groq");
});

test("explicit unconfigured provider returns a safe configuration error", () => {
  assert.deepEqual(resolveProvider({ GROQ_API_KEY: "g" }, "anthropic", "balanced"), {
    error: "PROVIDER_NOT_CONFIGURED", provider: "anthropic"
  });
});

test("Claude adapter uses Messages API and maps usage without exposing its key", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, headers: init.headers, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({
      model: "claude-sonnet-5-5",
      content: [{ type: "text", text: "سلام از کلود" }],
      usage: { input_tokens: 12, output_tokens: 7 }
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const result = await requestModel({
      provider: "anthropic",
      env: { CLAUDE_API_KEY: "secret-test-key", CLAUDE_MODEL: "claude-sonnet-5-5" },
      messages: [
        { role: "system", content: "system rules" },
        { role: "user", content: "سلام" }
      ]
    });
    assert.equal(captured.url, "https://api.anthropic.com/v1/messages");
    assert.equal(captured.headers["x-api-key"], "secret-test-key");
    assert.equal(captured.body.system, "system rules");
    assert.deepEqual(captured.body.messages, [{ role: "user", content: "سلام" }]);
    assert.equal(result.reply, "سلام از کلود");
    assert.deepEqual(result.usage, { promptTokens: 12, completionTokens: 7, totalTokens: 19 });
    assert.equal(JSON.stringify(result).includes("secret-test-key"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
