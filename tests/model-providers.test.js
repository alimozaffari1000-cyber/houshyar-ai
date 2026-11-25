import test from "node:test";
import assert from "node:assert/strict";
import { listAvailableProviders, resolveProvider, requestModel } from "../functions/api/_lib/model-providers.js";
import { onRequestPost, onRequestGet } from "../functions/api/chat.js";

test("provider availability reflects server-side secrets only", () => {
  assert.deepEqual(listAvailableProviders({ GROQ_API_KEY: "g" }).map(item => [item.id, item.available]), [
    ["groq", true], ["anthropic", false], ["google", false], ["deepseek", false], ["cloudflare_ai", false]
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

test("Claude adapter uses Messages API, omits unsupported sampling controls, and maps usage without exposing its key", async () => {
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
    assert.equal(Object.hasOwn(captured.body, "temperature"), false);
    assert.equal(Object.hasOwn(captured.body, "top_p"), false);
    assert.equal(Object.hasOwn(captured.body, "top_k"), false);
    assert.equal(result.reply, "سلام از کلود");
    assert.deepEqual(result.usage, { promptTokens: 12, completionTokens: 7, totalTokens: 19 });
    assert.equal(JSON.stringify(result).includes("secret-test-key"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("chat API can serve Claude without requiring a Groq key", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    model: "claude-sonnet-5-5",
    content: [{ type: "text", text: "پاسخ آزمایشی Claude" }],
    usage: { input_tokens: 3, output_tokens: 4 }
  }), { status: 200, headers: { "content-type": "application/json" } });
  try {
    const request = new Request("https://houshyar.example/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "سلام", provider: "anthropic", mode: "balanced" })
    });
    const response = await onRequestPost({ request, env: { CLAUDE_API_KEY: "test-secret" } });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.provider, "anthropic");
    assert.equal(data.reply, "پاسخ آزمایشی Claude");
    assert.equal(data.model, "claude-sonnet-5-5");
    assert.equal(JSON.stringify(data).includes("test-secret"), false);
    const health = await onRequestGet({ env: { CLAUDE_API_KEY: "test-secret" } });
    assert.equal(health.status, 200);
    assert.equal((await health.json()).providers.find(item => item.id === "anthropic").available, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("Google Gemini adapter maps system instructions, chat roles, and token usage", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, headers: init.headers, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "سلام از جمینای" }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 }
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const result = await requestModel({
      provider: "google",
      env: { GEMINI_API_KEY: "gemini-secret", GEMINI_MODEL: "gemini-2.5-flash" },
      messages: [
        { role: "system", content: "system rules" },
        { role: "user", content: "سلام" },
        { role: "assistant", content: "درود" }
      ]
    });
    assert.ok(captured.url.endsWith("/models/gemini-2.5-flash:generateContent"));
    assert.equal(captured.headers["x-goog-api-key"], "gemini-secret");
    assert.equal(captured.body.systemInstruction.parts[0].text, "system rules");
    assert.deepEqual(captured.body.contents.map(item => item.role), ["user", "model"]);
    assert.equal(result.reply, "سلام از جمینای");
    assert.deepEqual(result.usage, { promptTokens: 10, completionTokens: 5, totalTokens: 15 });
    assert.equal(JSON.stringify(result).includes("gemini-secret"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Google Gemini can serve chat requests and appears in health status", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: "پاسخ آزمایشی Gemini" }] } }],
    usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 3, totalTokenCount: 5 }
  }), { status: 200, headers: { "content-type": "application/json" } });
  try {
    const request = new Request("https://houshyar.example/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "سلام", provider: "google", mode: "balanced" })
    });
    const response = await onRequestPost({ request, env: { GEMINI_API_KEY: "test-gemini-secret" } });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.provider, "google");
    assert.equal(data.reply, "پاسخ آزمایشی Gemini");
    assert.equal(JSON.stringify(data).includes("test-gemini-secret"), false);
    const health = await onRequestGet({ env: { GEMINI_API_KEY: "test-gemini-secret" } });
    assert.equal(health.status, 200);
    assert.equal((await health.json()).providers.find(item => item.id === "google").available, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("Gemini web search enables grounding and returns only safe web sources", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({
      candidates: [{
        content: { parts: [{ text: "پاسخ مستند" }] },
        groundingMetadata: { groundingChunks: [
          { web: { title: "منبع معتبر", uri: "https://example.com/article" } },
          { web: { title: "نشانی نامعتبر", uri: "javascript:alert(1)" } },
          { web: { title: "منبع معتبر", uri: "https://example.com/article" } }
        ] }
      }],
      usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 6, totalTokenCount: 10 }
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const result = await requestModel({
      provider: "google",
      env: { GEMINI_API_KEY: "grounding-test-key", GEMINI_MODEL: "gemini-2.5-flash" },
      messages: [{ role: "user", content: "آخرین اطلاعات را بررسی کن" }],
      webSearch: true
    });
    assert.deepEqual(captured.body.tools, [{ google_search: {} }]);
    assert.equal(result.reply, "پاسخ مستند");
    assert.deepEqual(result.sources, [{ title: "منبع معتبر", url: "https://example.com/article" }]);
    assert.equal(JSON.stringify(result).includes("grounding-test-key"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("chat API enables Google grounding only for an explicitly selected Gemini provider", async () => {
  const originalFetch = globalThis.fetch;
  let capturedBody;
  globalThis.fetch = async (_url, init) => {
    capturedBody = JSON.parse(init.body);
    return new Response(JSON.stringify({
      candidates: [{
        content: { parts: [{ text: "پاسخ همراه منبع" }] },
        groundingMetadata: { groundingChunks: [{ web: { title: "راهنمای رسمی", uri: "https://example.com/guide" } }] }
      }],
      usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 3, totalTokenCount: 5 }
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const request = new Request("https://houshyar.example/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "اطلاعات جدید را بررسی کن", provider: "google", webSearch: true })
    });
    const response = await onRequestPost({ request, env: { GEMINI_API_KEY: "test-grounding-secret" } });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(capturedBody.tools, [{ google_search: {} }]);
    assert.deepEqual(data.sources, [{ title: "راهنمای رسمی", url: "https://example.com/guide" }]);
    assert.equal(JSON.stringify(data).includes("test-grounding-secret"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test("DeepSeek appears as a server-secret-backed fourth provider and supports deep-mode routing", () => {
  assert.deepEqual(listAvailableProviders({ DEEPSEEK_API_KEY: "d" }).map(item => [item.id, item.available]), [
    ["groq", false], ["anthropic", false], ["google", false], ["deepseek", true], ["cloudflare_ai", false]
  ]);
  assert.equal(resolveProvider({ GROQ_API_KEY: "g", DEEPSEEK_API_KEY: "d" }, "auto", "deep").provider, "deepseek");
  assert.deepEqual(resolveProvider({ GROQ_API_KEY: "g" }, "deepseek", "balanced"), {
    error: "PROVIDER_NOT_CONFIGURED", provider: "deepseek"
  });
});

test("DeepSeek adapter uses the official Chat Completions endpoint and maps token usage", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, headers: init.headers, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({
      model: "deepseek-flash",
      choices: [{ message: { role: "assistant", content: "سلام از دیپ‌سیک" } }],
      usage: { prompt_tokens: 11, completion_tokens: 9, total_tokens: 20 }
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const result = await requestModel({ provider: "deepseek", env: { DEEPSEEK_API_KEY: "deepseek-test-secret" }, messages: [{ role: "user", content: "سلام" }] });
    assert.equal(captured.url, "https://api.deepseek.com/chat/completions");
    assert.equal(captured.headers.Authorization, "Bearer deepseek-test-secret");
    assert.equal(captured.body.model, "deepseek-flash");
    assert.deepEqual(captured.body.thinking, { type: "disabled" });
    assert.equal(result.reply, "سلام از دیپ‌سیک");
    assert.deepEqual(result.usage, { promptTokens: 11, completionTokens: 9, totalTokens: 20 });
    assert.equal(JSON.stringify(result).includes("deepseek-test-secret"), false);
  } finally { globalThis.fetch = originalFetch; }
});

test("DeepSeek deep mode enables thinking and the chat health endpoint reports it", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (_url, init) => {
    captured = JSON.parse(init.body);
    return new Response(JSON.stringify({ model: "deepseek-v4-pro", choices: [{ message: { content: "تحلیل آزمایشی" } }], usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 } }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const request = new Request("https://houshyar.example/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "تحلیل کن", provider: "deepseek", mode: "deep" }) });
    const response = await onRequestPost({ request, env: { DEEPSEEK_API_KEY: "test-deepseek-secret" } });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.provider, "deepseek");
    assert.equal(data.model, "deepseek-v4-pro");
    assert.deepEqual(captured.thinking, { type: "enabled" });
    assert.equal(JSON.stringify(data).includes("test-deepseek-secret"), false);
    const health = await onRequestGet({ env: { DEEPSEEK_API_KEY: "test-deepseek-secret" } });
    assert.equal(health.status, 200);
    assert.equal((await health.json()).providers.find(item => item.id === "deepseek").available, true);
  } finally { globalThis.fetch = originalFetch; }
});

test("Cloudflare Workers AI binding is detected and used as the free fallback", async () => {
  let captured;
  const env = { AI: { run: async (model, input) => { captured = { model, input }; return { response: "پاسخ آزمایشی از هوش مصنوعی Cloudflare", model, usage: { prompt_tokens: 7, completion_tokens: 9, total_tokens: 16 } }; } } };
  assert.equal(listAvailableProviders(env).find(item => item.id === "cloudflare_ai").available, true);
  assert.equal(resolveProvider(env, "auto", "balanced").provider, "cloudflare_ai");
  const result = await requestModel({ provider: "cloudflare_ai", env, messages: [{ role: "user", content: "سلام" }], maxTokens: 500, temperature: 0.4 });
  assert.equal(captured.model, "@cf/zai-org/glm-4.7-flash");
  assert.deepEqual(captured.input.messages, [{ role: "user", content: "سلام" }]);
  assert.equal(captured.input.max_completion_tokens, 500);
  assert.equal(result.reply, "پاسخ آزمایشی از هوش مصنوعی Cloudflare");
  assert.deepEqual(result.usage, { promptTokens: 7, completionTokens: 9, totalTokens: 16 });
});

test("Cloudflare Workers AI can answer chat requests without external API secrets", async () => {
  const env = { AI: { run: async model => ({ choices: [{ message: { content: "سلام، پاسخ از مدل متصل به Cloudflare" } }], model, usage: { prompt_tokens: 2, completion_tokens: 5, total_tokens: 7 } }) } };
  const request = new Request("https://houshyar.example/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "سلام", provider: "auto", mode: "balanced" }) });
  const response = await onRequestPost({ request, env });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.provider, "cloudflare_ai");
  assert.equal(data.reply, "سلام، پاسخ از مدل متصل به Cloudflare");
  const health = await onRequestGet({ env });
  assert.equal(health.status, 200);
  assert.equal((await health.json()).aiConfigured, true);
});


test("provider status remains readable when no AI provider is configured", async () => {
  const response = await onRequestGet({ env: {} });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.status, "configuration_required");
  assert.equal(data.aiConfigured, false);
  assert.ok(data.providers.length > 0);
  assert.equal(data.providers.every(item => item.available === false), true);
});


test("Cloudflare Workers AI respects the chat request abort signal", async () => {
  const controller = new AbortController();
  const env = { AI: { run: async () => new Promise(() => {}) } };
  const pending = requestModel({
    provider: "cloudflare_ai",
    env,
    messages: [{ role: "user", content: "سلام" }],
    signal: controller.signal
  });
  controller.abort("upstream_timeout");
  await assert.rejects(pending, /upstream_timeout/);
});
