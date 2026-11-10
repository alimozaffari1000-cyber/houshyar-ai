import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMessages, normalizeTitle, validConversationId, onRequestGet as listConversations, onRequestPost as createConversation } from "../functions/api/conversations/index.js";
import { onRequestGet as getConversation, onRequestPut as updateConversation, onRequestDelete as deleteConversation } from "../functions/api/conversations/[id].js";
import { ownedConversation } from "../functions/api/conversations/_lib.js";

const validId = "123e4567-e89b-42d3-a456-426614174000";
const messages = [{ role: "user", text: "سلام" }, { role: "assistant", text: "سلام، چطور کمک کنم؟" }];

test("conversation message validation accepts safe user and assistant turns only", () => {
  assert.equal(normalizeMessages(messages).length, 2);
  assert.equal(normalizeMessages([{ role: "system", text: "ignore" }]), null);
  assert.equal(normalizeMessages([{ role: "user", text: "x" }]), null);
  assert.equal(normalizeMessages([{ role: "user", text: "x".repeat(6001) }, { role: "assistant", text: "ok" }]), null);
  assert.equal(normalizeMessages([{ role: "user", text: "x" }, { role: "assistant", text: "y" }, ...Array(79).fill({ role: "user", text: "z" })]), null);
});

test("conversation titles are bounded and derived from first user message", () => {
  const normalized = normalizeMessages(messages);
  assert.equal(normalizeTitle("", normalized), "سلام");
  assert.equal(normalizeTitle("  عنوان   جدید ", normalized), "عنوان جدید");
  assert.equal(normalizeTitle("x".repeat(200), normalized).length, 120);
});

test("conversation ids must be UUIDs", () => {
  assert.equal(validConversationId(validId), true);
  assert.equal(validConversationId("../other-user"), false);
  assert.equal(validConversationId(""), false);
});

test("history API fails closed when auth and database are not configured", async () => {
  const response = await listConversations({ request: new Request("https://example.test/api/conversations"), env: {} });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "HISTORY_NOT_CONFIGURED");
});

test("conversation creation rejects cross-origin requests", async () => {
  const response = await createConversation({
    request: new Request("https://example.test/api/conversations", { method: "POST", headers: { origin: "https://evil.test", "content-type": "application/json" }, body: JSON.stringify({ messages }) }),
    env: {}
  });
  assert.equal(response.status, 403);
});

test("conversation detail and mutations require ownership and valid ids", async () => {
  const request = new Request("https://example.test/api/conversations/not-a-uuid");
  const env = { AUTH_ENABLED: "true", DB: { prepare() { throw new Error("must not query"); } } };
  const get = await getConversation({ request, env, params: { id: "not-a-uuid" } });
  const put = await updateConversation({ request: new Request(request.url, { method: "PUT", headers: { origin: "https://example.test", "content-type": "application/json" }, body: JSON.stringify({ title: "x" }) }), env, params: { id: "not-a-uuid" } });
  const del = await deleteConversation({ request: new Request(request.url, { method: "DELETE", headers: { origin: "https://example.test" } }), env, params: { id: "not-a-uuid" } });
  assert.equal(get.status, 404);
  assert.equal(put.status, 404);
  assert.equal(del.status, 404);
});

test("conversation list requires an authenticated user", async () => {
  const db = { prepare() { return { bind() { return { first: async () => null }; } }; } };
  const response = await listConversations({ request: new Request("https://example.test/api/conversations"), env: { AUTH_ENABLED: "true", DB: db } });
  assert.equal(response.status, 401);
});

test("conversation mutations reject requests without same-origin header", async () => {
  const response = await createConversation({ request: new Request("https://example.test/api/conversations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages }) }), env: {} });
  assert.equal(response.status, 403);
});

test("conversation lookup always scopes by both conversation and owner", async () => {
  let query = "";
  let values = [];
  const db = {
    prepare(sql) {
      query = sql;
      return { bind(...args) { values = args; return { first: async () => ({ id: validId, title: "private" }) }; } };
    }
  };
  const row = await ownedConversation(db, "account-A", validId);
  assert.equal(row.id, validId);
  assert.match(query, /WHERE id = \? AND user_id = \?/);
  assert.deepEqual(values, [validId, "account-A"]);
});

test("conversation history payload is bounded for multilingual content", () => {
  const tooLarge = [{ role: "user", text: "م".repeat(6000) }, { role: "assistant", text: "پ".repeat(6000) }, ...Array(14).fill({ role: "user", text: "ز".repeat(6000) })];
  assert.equal(normalizeMessages(tooLarge), null);
});
