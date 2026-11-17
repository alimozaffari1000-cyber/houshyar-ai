import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/chat.js";

function chatRequest(body) {
  return new Request("https://houshyar.example/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "سلام", ...body })
  });
}

function metricsDb(rows, { fail = false } = {}) {
  let queried = 0;
  return {
    get queried() { return queried; },
    prepare(sql) {
      assert.match(sql, /FROM operational_metrics/);
      return {
        bind() {
          return {
            async all() {
              queried += 1;
              if (fail) throw new Error("metrics_unavailable");
              return { results: rows };
            }
          };
        }
      };
    }
  };
}

test("auto fast mode uses recent provider metrics after the evidence threshold", async () => {
  const originalFetch = globalThis.fetch;
  let selectedUrl = "";
  globalThis.fetch = async (url) => {
    selectedUrl = String(url);
    if (selectedUrl.includes("api.anthropic.com")) {
      return new Response(JSON.stringify({
        model: "claude-sonnet-5-5",
        content: [{ type: "text", text: "پاسخ Claude" }],
        usage: { input_tokens: 2, output_tokens: 3 }
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({
      model: "llama-3.3-70b-versatile",
      choices: [{ message: { content: "پاسخ Groq" } }],
      usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 }
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const db = metricsDb([
      { provider: "groq", successes: 5, failures: 1, avg_latency_ms: 900 },
      { provider: "anthropic", successes: 5, failures: 1, avg_latency_ms: 120 }
    ]);
    const response = await onRequestPost({
      request: chatRequest({ provider: "auto", mode: "fast" }),
      env: { GROQ_API_KEY: "g-test", CLAUDE_API_KEY: "c-test", OBSERVABILITY_ENABLED: "true", DB: db },
      ctx: { waitUntil() {} }
    });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.provider, "anthropic");
    assert.equal(data.selectionStrategy, "observed_performance");
    assert.match(selectedUrl, /api.anthropic.com/);
    assert.equal(db.queried, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("explicit provider choice bypasses adaptive routing", async () => {
  const originalFetch = globalThis.fetch;
  let selectedUrl = "";
  globalThis.fetch = async (url) => {
    selectedUrl = String(url);
    return new Response(JSON.stringify({
      model: "llama-3.3-70b-versatile",
      choices: [{ message: { content: "پاسخ Groq" } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const db = metricsDb([
      { provider: "anthropic", successes: 20, failures: 0, avg_latency_ms: 10 }
    ]);
    const response = await onRequestPost({
      request: chatRequest({ provider: "groq", mode: "fast" }),
      env: { GROQ_API_KEY: "g-test", CLAUDE_API_KEY: "c-test", OBSERVABILITY_ENABLED: "true", DB: db },
      ctx: { waitUntil() {} }
    });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.provider, "groq");
    assert.equal(data.selectionStrategy, "configured_default");
    assert.match(selectedUrl, /api.groq.com/);
    assert.equal(db.queried, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("adaptive routing falls back to configured default when metrics storage fails", async () => {
  const originalFetch = globalThis.fetch;
  let selectedUrl = "";
  globalThis.fetch = async (url) => {
    selectedUrl = String(url);
    return new Response(JSON.stringify({
      model: "llama-3.3-70b-versatile",
      choices: [{ message: { content: "پاسخ Groq" } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const db = metricsDb([], { fail: true });
    const response = await onRequestPost({
      request: chatRequest({ provider: "auto", mode: "fast" }),
      env: { GROQ_API_KEY: "g-test", CLAUDE_API_KEY: "c-test", OBSERVABILITY_ENABLED: "true", DB: db },
      ctx: { waitUntil() {} }
    });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.provider, "groq");
    assert.equal(data.selectionStrategy, "configured_default");
    assert.match(selectedUrl, /api.groq.com/);
    assert.equal(db.queried, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
