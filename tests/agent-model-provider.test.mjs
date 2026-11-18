import test from "node:test";
import assert from "node:assert/strict";
import { createModelProvider } from "../scripts/agent-model-provider.mjs";

test("model calls are disabled by default", async () => {
  const provider = createModelProvider({});
  assert.equal(provider.available, false);
  await assert.rejects(() => provider.complete({ task: "research_summary", prompt: "test" }), /disabled/);
});

test("online mode requires HTTPS and a server-side key", () => {
  assert.throws(() => createModelProvider({
    HOUSHYAR_AGENT_MODEL_MODE: "online",
    HOUSHYAR_AGENT_MODEL_URL: "http://api.example.test"
  }), /HTTPS/);
  assert.throws(() => createModelProvider({
    HOUSHYAR_AGENT_MODEL_MODE: "online",
    HOUSHYAR_AGENT_MODEL_URL: "https://api.example.test"
  }), /API key/);
});

test("offline mode rejects non-loopback endpoints", () => {
  assert.throws(() => createModelProvider({
    HOUSHYAR_AGENT_MODEL_MODE: "offline",
    HOUSHYAR_AGENT_MODEL_URL: "https://remote.example.test"
  }), /localhost/);
});

test("provider enforces task allowlist and prompt limit before network call", async () => {
  let calls = 0;
  const provider = createModelProvider({
    HOUSHYAR_AGENT_MODEL_MODE: "offline",
    HOUSHYAR_AGENT_MODEL_URL: "http://127.0.0.1:11434/v1",
    HOUSHYAR_AGENT_MODEL_NAME: "local-model"
  }, async () => { calls += 1; });
  await assert.rejects(() => provider.complete({ task: "execute_shell", prompt: "no" }), /Unsupported/);
  await assert.rejects(() => provider.complete({ task: "research_summary", prompt: "x".repeat(12001) }), /size limit/);
  assert.equal(calls, 0);
});

test("provider sends constrained request and returns model text", async () => {
  let captured;
  const provider = createModelProvider({
    HOUSHYAR_AGENT_MODEL_MODE: "offline",
    HOUSHYAR_AGENT_MODEL_URL: "http://localhost:11434/v1",
    HOUSHYAR_AGENT_MODEL_NAME: "local-model"
  }, async (url, options) => {
    captured = { url, options, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ choices: [{ message: { content: "review complete" } }] }) };
  });
  assert.equal(await provider.complete({ task: "patch_review", prompt: "Review this patch" }), "review complete");
  assert.equal(captured.url, "http://localhost:11434/v1/chat/completions");
  assert.equal(captured.body.max_tokens, 2048);
  assert.equal(captured.options.headers.authorization, undefined);
});
