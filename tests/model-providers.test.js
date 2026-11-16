import test from "node:test";
import assert from "node:assert/strict";
import { listAvailableProviders, resolveProvider, requestModel } from "../functions/api/_lib/model-providers.js";
import { onRequestPost, onRequestGet } from "../functions/api/chat.js";

test("provider availability reflects server-side secrets only", () => {
  assert.deepEqual(listAvailableProviders({ GROQ_API_KEY: "g" }).map(item => [item.id, item.available]), [
    ["groq", true], ["openai", false], ["anthropic", false]
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


test("Groq streaming adapter emits text deltas and reports the selected model", async () => {
  const originalFetch = globalThis.fetch;
  let sentBody;
  globalThis.fetch = async (_url, init) => {
    sentBody = JSON.parse(init.body);
    return new Response([
      'data: {"choices":[{"delta":{"content":"سلام "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"هوش‌یار"}}]}\n\n',
      'data: [DONE]\n\n'
    ].join(""), { status: 200, headers: { "content-type": "text/event-stream" } });
  };
  try {
    const { streamModel } = await import("../functions/api/_lib/model-providers.js");
    const deltas = [];
    const result = await streamModel({
      provider: "groq", env: { GROQ_API_KEY: "stream-test" },
      messages: [{ role: "user", content: "سلام" }],
      onText: value => deltas.push(value)
    });
    assert.equal(sentBody.stream, true);
    assert.deepEqual(deltas, ["سلام ", "هوش‌یار"]);
    assert.equal(result.reply, "سلام هوش‌یار");
  } finally { globalThis.fetch = originalFetch; }
});

test("Claude streaming adapter parses content_block_delta events", async () => {
  const originalFetch = globalThis.fetch;
  let sentBody;
  globalThis.fetch = async (_url, init) => {
    sentBody = JSON.parse(init.body);
    return new Response([
      'event: content_block_delta\n',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"پاسخ "}}\n\n',
      'event: content_block_delta\n',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"زنده"}}\n\n',
      'data: {"type":"message_stop"}\n\n'
    ].join(""), { status: 200, headers: { "content-type": "text/event-stream" } });
  };
  try {
    const { streamModel } = await import("../functions/api/_lib/model-providers.js");
    const deltas = [];
    const result = await streamModel({
      provider: "anthropic", env: { CLAUDE_API_KEY: "stream-test" },
      messages: [{ role: "system", content: "قواعد" }, { role: "user", content: "سلام" }],
      onText: value => deltas.push(value)
    });
    assert.equal(sentBody.stream, true);
    assert.equal(sentBody.system, "قواعد");
    assert.deepEqual(deltas, ["پاسخ ", "زنده"]);
    assert.equal(result.reply, "پاسخ زنده");
  } finally { globalThis.fetch = originalFetch; }
});


test("streaming parser handles chunk boundaries, CRLF separators, and a final event without a blank line", async () => {
  const originalFetch = globalThis.fetch;
  const encoder = new TextEncoder();
  const chunks = [
    'data: {"choices":[{"delta":{"content":"تکه اول "}}]}\r',
    '\n\r\ndata: {"choices":[{"delta":{"content":"تکه دوم"}}]}'
  ];
  globalThis.fetch = async () => new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    }
  }), { status: 200, headers: { "content-type": "text/event-stream" } });
  try {
    const { streamModel } = await import("../functions/api/_lib/model-providers.js");
    const deltas = [];
    const result = await streamModel({
      provider: "groq",
      env: { GROQ_API_KEY: "stream-test" },
      messages: [{ role: "user", content: "آزمایش" }],
      onText: value => deltas.push(value)
    });
    assert.deepEqual(deltas, ["تکه اول ", "تکه دوم"]);
    assert.equal(result.reply, "تکه اول تکه دوم");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OpenAI provider is independently configurable and selected by auto mode", () => {
  const providers = listAvailableProviders({ OPENAI_API_KEY: "openai-secret" });
  assert.deepEqual(providers.map(item => [item.id, item.available]), [
    ["groq", false], ["openai", true], ["anthropic", false]
  ]);
  assert.equal(resolveProvider({ OPENAI_API_KEY: "openai-secret" }).provider, "openai");
  assert.equal(resolveProvider({ OPENAI_API_KEY: "openai-secret", OPENAI_MODEL: "custom-gpt" }).model, "custom-gpt");
});

test("OpenAI chat completions use the official endpoint and server-side key", async () => {
  const originalFetch = globalThis.fetch;
  let call;
  globalThis.fetch = async (url, options) => {
    call = { url, headers: options.headers, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ model: "custom-gpt", choices: [{ message: { content: "پاسخ از OpenAI" } }], usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 } }), { status: 200 });
  };
  try {
    const result = await requestModel({ provider: "openai", env: { OPENAI_API_KEY: "secret-key", OPENAI_MODEL: "custom-gpt" }, messages: [{ role: "user", content: "سلام" }] });
    assert.equal(call.url, "https://api.openai.com/v1/chat/completions");
    assert.equal(call.headers.Authorization, "Bearer secret-key");
    assert.equal(call.body.model, "custom-gpt");
    assert.equal(call.body.max_completion_tokens, 1200);
    assert.equal("temperature" in call.body, false);
    assert.equal("max_tokens" in call.body, false);
    assert.equal(result.reply, "پاسخ از OpenAI");
    assert.equal(result.usage.totalTokens, 7);
  } finally { globalThis.fetch = originalFetch; }
});

test("auto provider respects a configured default only when its key is present", () => {
  assert.equal(resolveProvider({ AI_DEFAULT_PROVIDER: "openai", GROQ_API_KEY: "g" }).provider, "groq");
  assert.equal(resolveProvider({ AI_DEFAULT_PROVIDER: "openai", OPENAI_API_KEY: "o", GROQ_API_KEY: "g" }).provider, "openai");
});
test("OpenAI streaming uses GPT-compatible parameters and emits incremental deltas", async () => {
  const originalFetch = globalThis.fetch;
  let sentBody;
  globalThis.fetch = async (_url, init) => {
    sentBody = JSON.parse(init.body);
    return new Response([
      `data: {"choices":[{"delta":{"content":"پاسخ "}}]}\n\n`,
      `data: {"choices":[{"delta":{"content":"جریانی"}}]}\n\n`,
      `data: [DONE]\n\n`
    ].join(""), { status: 200, headers: { "content-type": "text/event-stream" } });
  };
  try {
    const { streamModel } = await import("../functions/api/_lib/model-providers.js");
    const deltas = [];
    const result = await streamModel({ provider: "openai", env: { OPENAI_API_KEY: "stream-secret" }, messages: [{ role: "user", content: "سلام" }], onText: value => deltas.push(value) });
    assert.equal(sentBody.stream, true);
    assert.equal(sentBody.max_completion_tokens, 1200);
    assert.equal("temperature" in sentBody, false);
    assert.deepEqual(deltas, ["پاسخ ", "جریانی"]);
    assert.equal(result.reply, "پاسخ جریانی");
  } finally { globalThis.fetch = originalFetch; }
});

test("Groq default model uses a currently supported production model", () => {
  const providers = listAvailableProviders({ GROQ_API_KEY: "groq-secret" });
  assert.equal(providers.find(item => item.id === "groq").defaultModel, "openai/gpt-oss-120b");
  assert.equal(resolveProvider({ GROQ_API_KEY: "groq-secret" }).model, "openai/gpt-oss-120b");
});
