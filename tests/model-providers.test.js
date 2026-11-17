import test from "node:test";
import assert from "node:assert/strict";
import { listAvailableProviders, resolveProvider, requestModel } from "../functions/api/_lib/model-providers.js";
import { onRequestPost, onRequestGet } from "../functions/api/chat.js";

test("provider adapters reject malformed or excessive inputs before making upstream requests", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("{}", { status: 200 });
  };
  try {
    const base = {
      provider: "groq",
      env: { GROQ_API_KEY: "test" },
      messages: [{ role: "user", content: "سلام" }]
    };
    for (const invalid of [
      { messages: "not-an-array" },
      { messages: [] },
      { messages: Array.from({ length: 33 }, () => ({ role: "user", content: "x" })) },
      { messages: [{ role: "system", content: "x".repeat(12001) }] },
      { messages: [{ role: "user", content: "x".repeat(12000) }, { role: "assistant", content: "y".repeat(12000) }, { role: "user", content: "z".repeat(12000) }] },
      { messages: [{ role: "tool", content: "unexpected role" }] },
      { messages: [{ role: "user", content: 42 }] },
      { maxTokens: 0 },
      { maxTokens: 8193 },
      { temperature: Number.NaN },
      { temperature: 2.1 }
    ]) {
      await assert.rejects(
        requestModel({ ...base, ...invalid }),
        { message: "provider_invalid_request" }
      );
    }
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OpenAI adapter uses the official API, normalizes usage, and keeps its key server-side", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, headers: init.headers, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ model: "gpt-6-luna", output: [{ type: "message", content: [{ type: "output_text", text: "سلام از OpenAI" }] }], usage: { input_tokens: 13, output_tokens: 9, total_tokens: 22 } }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const result = await requestModel({ provider: "openai", env: { OPENAI_API_KEY: "openai-private-test-key" }, messages: [{ role: "system", content: "system rules" }, { role: "user", content: "سلام" }] });
    assert.equal(captured.url, "https://api.openai.com/v1/responses");
    assert.equal(captured.headers.Authorization, "Bearer openai-private-test-key");
    assert.equal(captured.body.model, "gpt-6-luna");
    assert.equal(captured.body.instructions, "system rules");\n    assert.equal(captured.body.input[0].role, "user");\n    assert.equal(captured.body.max_output_tokens, 1200);
    assert.equal(result.reply, "سلام از OpenAI");
    assert.deepEqual(result.usage, { promptTokens: 13, completionTokens: 9, totalTokens: 22 });
    assert.equal(JSON.stringify(result).includes("openai-private-test-key"), false);
  } finally { globalThis.fetch = originalFetch; }
});

test("OpenAI is listed, selectable, and used as the final auto fallback", () => {
  assert.equal(listAvailableProviders({ OPENAI_API_KEY: "k" }).find(item => item.id === "openai").available, true);
  assert.deepEqual(resolveProvider({ OPENAI_API_KEY: "k" }, "auto", "balanced"), { provider: "openai", model: "gpt-6-luna" });
  assert.deepEqual(resolveProvider({ GROQ_API_KEY: "g" }, "openai", "balanced"), { error: "PROVIDER_NOT_CONFIGURED", provider: "openai" });
});

test("chat API can serve OpenAI without requiring other provider keys", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ model: "gpt-6-luna", output: [{ type: "message", content: [{ type: "output_text", text: "پاسخ آزمایشی OpenAI" }] }], usage: { input_tokens: 2, output_tokens: 3, total_tokens: 5 } }), { status: 200, headers: { "content-type": "application/json" } });
  try {
    const request = new Request("https://houshyar.example/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "سلام", provider: "openai", mode: "balanced" }) });
    const response = await onRequestPost({ request, env: { OPENAI_API_KEY: "openai-test-secret" } });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.provider, "openai");
    assert.equal(data.reply, "پاسخ آزمایشی OpenAI");
    assert.equal(data.model, "gpt-6-luna");
    assert.equal(JSON.stringify(data).includes("openai-test-secret"), false);
    const health = await onRequestGet({ env: { OPENAI_API_KEY: "openai-test-secret" } });
    assert.equal(health.status, 200);
    assert.equal((await health.json()).providers.find(item => item.id === "openai").available, true);
  } finally { globalThis.fetch = originalFetch; }
});
test("provider availability reflects server-side secrets only", () => {
  assert.deepEqual(listAvailableProviders({ GROQ_API_KEY: "g" }).map(item => [item.id, item.available]), [
    ["groq", true], ["anthropic", false], ["google", false]
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

test("Google Gemini adapter maps system and conversation roles and keeps its API key server-side", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, headers: init.headers, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ modelVersion: "gemini-3.1-flash-lite", candidates: [{ content: { role: "model", parts: [{ text: "سلام از جمینای" }] }, groundingMetadata: { groundingChunks: [{ web: { uri: "https://example.com/source", title: "منبع نمونه" } }, { web: { uri: "javascript:alert(1)", title: "نامعتبر" } }, { web: { uri: "http://insecure.example/source", title: "ناامن" } }, { web: { uri: "https://user:pass@example.com/private", title: "دارای اطلاعات ورود" } }, { web: { uri: "https://", title: "نشانی خراب" } }, { web: { uri: "https://example.com/source", title: "تکراری" } }] } }], usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 8, totalTokenCount: 19 } }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const result = await requestModel({ provider: "google", env: { GEMINI_API_KEY: "gemini-secret-test", GEMINI_MODEL: "gemini-3.1-flash-lite" }, webSearch: true, messages: [{ role: "system", content: "system rules" }, { role: "user", content: "سلام" }, { role: "assistant", content: "درود" }, { role: "user", content: "ادامه بده" }] });
    assert.equal(captured.url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent");
    assert.equal(captured.headers["x-goog-api-key"], "gemini-secret-test");
    assert.deepEqual(captured.body.systemInstruction, { parts: [{ text: "system rules" }] });
    assert.deepEqual(captured.body.contents.map(item => item.role), ["user", "model", "user"]);
    assert.equal(captured.body.generationConfig.maxOutputTokens, 1200);
    assert.equal(Object.hasOwn(captured.body.generationConfig, "temperature"), false);
    assert.deepEqual(captured.body.tools, [{ google_search: {} }]);
    assert.deepEqual(result.sources, [{ title: "منبع نمونه", url: "https://example.com/source" }]);
    assert.equal(result.reply, "سلام از جمینای");
    assert.deepEqual(result.usage, { promptTokens: 11, completionTokens: 8, totalTokens: 19 });
    assert.equal(JSON.stringify(result).includes("gemini-secret-test"), false);
  } finally { globalThis.fetch = originalFetch; }
});

test("automatic provider selection supports Google Gemini when it is the only configured provider", () => {
  assert.equal(resolveProvider({ GEMINI_API_KEY: "g" }, "auto", "balanced").provider, "google");
  assert.equal(resolveProvider({ GEMINI_API_KEY: "g", AI_DEFAULT_PROVIDER: "google" }, "auto", "fast").provider, "google");
  assert.deepEqual(resolveProvider({ GROQ_API_KEY: "g" }, "google", "balanced"), { error: "PROVIDER_NOT_CONFIGURED", provider: "google" });
});

test("chat API accepts Google Gemini as a configured provider", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ modelVersion: "gemini-3.1-flash-lite", candidates: [{ content: { parts: [{ text: "پاسخ آزمایشی Gemini" }] } }], usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 3, totalTokenCount: 5 } }), { status: 200, headers: { "content-type": "application/json" } });
  try {
    const request = new Request("https://houshyar.example/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "سلام", provider: "google", mode: "balanced" }) });
    const response = await onRequestPost({ request, env: { GEMINI_API_KEY: "test-secret" } });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.provider, "google");
    assert.equal(data.reply, "پاسخ آزمایشی Gemini");
    assert.equal(data.model, "gemini-3.1-flash-lite");
    assert.equal(JSON.stringify(data).includes("test-secret"), false);
    const health = await onRequestGet({ env: { GEMINI_API_KEY: "test-secret" } });
    assert.equal(health.status, 200);
    assert.equal((await health.json()).providers.find(item => item.id === "google").available, true);
  } finally { globalThis.fetch = originalFetch; }
});

test("Gemini web search is opt-in and returns grounded source links through chat API", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = JSON.parse(init.body);
    return new Response(JSON.stringify({
      modelVersion: "gemini-3.1-flash-lite",
      candidates: [{ content: { parts: [{ text: "پاسخ مستند" }] }, groundingMetadata: { groundingChunks: [{ web: { uri: "https://developers.google.com", title: "Google Developers" } }] } }],
      usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 3, totalTokenCount: 5 }
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const request = new Request("https://houshyar.example/api/chat", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "آخرین قابلیت‌های گوگل چیست؟", provider: "google", webSearch: true })
    });
    const response = await onRequestPost({ request, env: { GEMINI_API_KEY: "test-secret" } });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(captured.tools, [{ google_search: {} }]);
    assert.deepEqual(data.sources, [{ title: "Google Developers", url: "https://developers.google.com/" }]);
    assert.equal(data.reply, "پاسخ مستند");
  } finally { globalThis.fetch = originalFetch; }
});

test("Gemini Search cannot be enabled by requests using another provider", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = JSON.parse(init.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: "پاسخ Groq" } }], model: "llama-3.3-70b-versatile" }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const request = new Request("https://houshyar.example/api/chat", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "سلام", provider: "groq", webSearch: true })
    });
    const response = await onRequestPost({ request, env: { GROQ_API_KEY: "test-secret" } });
    assert.equal(response.status, 200);
    assert.equal(Object.hasOwn(captured, "tools"), false);
  } finally { globalThis.fetch = originalFetch; }
});


test("provider adapters treat incomplete token usage as unknown rather than zero-cost", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({
      modelVersion: "gemini-3.1-flash-lite",
      candidates: [{ content: { parts: [{ text: "پاسخ" }] } }],
      usageMetadata: { promptTokenCount: 15 }
    }), { status: 200, headers: { "content-type": "application/json" } });
    const gemini = await requestModel({
      provider: "google", env: { GEMINI_API_KEY: "test" },
      messages: [{ role: "user", content: "سلام" }]
    });
    assert.equal(gemini.usage, null);

    globalThis.fetch = async () => new Response(JSON.stringify({
      model: "claude-sonnet-5-5",
      content: [{ type: "text", text: "پاسخ" }],
      usage: { input_tokens: 10 }
    }), { status: 200, headers: { "content-type": "application/json" } });
    const claude = await requestModel({
      provider: "anthropic", env: { CLAUDE_API_KEY: "test" },
      messages: [{ role: "user", content: "سلام" }]
    });
    assert.equal(claude.usage, null);

    globalThis.fetch = async () => new Response(JSON.stringify({
      model: "llama-test",
      choices: [{ message: { content: "پاسخ" } }],
      usage: { prompt_tokens: 10 }
    }), { status: 200, headers: { "content-type": "application/json" } });
    const groq = await requestModel({
      provider: "groq", env: { GROQ_API_KEY: "test" },
      messages: [{ role: "user", content: "سلام" }]
    });
    assert.equal(groq.usage, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("all provider adapters normalize upstream HTTP failures without leaking response bodies or API keys", async () => {
  const originalFetch = globalThis.fetch;
  const cases = [
    { provider: "groq", env: { GROQ_API_KEY: "groq-private-key" } },
    { provider: "anthropic", env: { CLAUDE_API_KEY: "claude-private-key" } },
    { provider: "google", env: { GEMINI_API_KEY: "gemini-private-key" } }
  ];
  try {
    for (const item of cases) {
      globalThis.fetch = async () => new Response(
        JSON.stringify({ error: "unauthorized", diagnostic: "private upstream detail" }),
        { status: 401, headers: { "content-type": "application/json" } }
      );
      await assert.rejects(
        requestModel({
          provider: item.provider,
          env: item.env,
          messages: [{ role: "user", content: "سلام" }]
        }),
        error => {
          assert.equal(error.message, "provider_request_failed");
          assert.equal(error.message.includes("private"), false);
          assert.equal(error.message.includes("private-key"), false);
          return true;
        }
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Gemini rejects system-only prompts without making an upstream request", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("{}", { status: 200 });
  };
  try {
    await assert.rejects(
      requestModel({
        provider: "google",
        env: { GEMINI_API_KEY: "test-secret" },
        messages: [{ role: "system", content: "system rules" }]
      }),
      { message: "provider_empty_prompt" }
    );
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("partial model comparison waits for successful calls before returning a safe failure", async () => {
  const originalFetch = globalThis.fetch;
  let groqCompleted = false;
  const requested = [];
  globalThis.fetch = async url => {
    requested.push(String(url));
    if (String(url).includes("api.groq.com")) {
      await new Promise(resolve => setTimeout(resolve, 30));
      groqCompleted = true;
      return new Response(JSON.stringify({
        model: "llama-test",
        choices: [{ message: { content: "پاسخ موفق گروک" } }],
        usage: { prompt_tokens: 5, completion_tokens: 6, total_tokens: 11 }
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({
      error: "private upstream diagnostic",
      detail: "claude-private-key"
    }), { status: 401, headers: { "content-type": "application/json" } });
  };
  try {
    const request = new Request("https://houshyar.example/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "مقایسه کن", compare: true })
    });
    const response = await onRequestPost({
      request,
      env: { GROQ_API_KEY: "groq-test", CLAUDE_API_KEY: "claude-private-key" }
    });
    const data = await response.json();
    assert.equal(response.status, 502);
    assert.equal(data.error, "COMPARISON_FAILED");
    assert.equal(groqCompleted, true);
    assert.equal(requested.length, 2);
    assert.equal(JSON.stringify(data).includes("private"), false);
    assert.equal(JSON.stringify(data).includes("claude-private-key"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
