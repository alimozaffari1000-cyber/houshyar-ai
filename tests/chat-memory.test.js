import test from "node:test";
import assert from "node:assert/strict";
import { normalizeChatHistory } from "../src/chat-memory.js";

test("normalizes saved chat sessions and retains the newest 40", () => {
  const history = Array.from({ length: 45 }, (_, index) => ({
    id: "chat-" + index,
    title: " گفتگو " + index,
    updatedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    messages: [{ role: "user", text: "پیام " + index }]
  }));
  const result = normalizeChatHistory(history);
  assert.equal(result.length, 40);
  assert.equal(result[0].id, "chat-44");
  assert.equal(result.at(-1).id, "chat-5");
});

test("rejects malformed sessions and unsupported message roles", () => {
  const result = normalizeChatHistory([
    null,
    { id: "bad", messages: "not-an-array" },
    { id: "ok", messages: [
      { role: "system", text: "نباید وارد تاریخچه شود" },
      { role: "user", text: "پیام معتبر" }
    ] }
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].messages.length, 1);
  assert.equal(result[0].messages[0].role, "user");
});

test("bounds message count, message size, title and metadata", () => {
  const result = normalizeChatHistory([{
    id: "safe",
    title: "عنوان".repeat(30),
    updatedAt: "invalid-date",
    messages: Array.from({ length: 35 }, (_, index) => ({
      role: index % 2 ? "assistant" : "user",
      text: "x".repeat(7000),
      agent: { id: "a".repeat(100), label: "b".repeat(100) },
      collaboration: { enabled: true, status: "untrusted" }
    }))
  }]);
  assert.equal(result[0].messages.length, 30);
  assert.equal(result[0].messages[0].text.length, 6000);
  assert.equal(result[0].title.length, 56);
  assert.equal(result[0].messages[0].agent.id.length, 48);
  assert.equal(result[0].messages[0].agent.label.length, 80);
  assert.equal(result[0].messages[0].collaboration.status, "unknown");
});

test("ignores empty history and malformed top-level values", () => {
  assert.deepEqual(normalizeChatHistory(null), []);
  assert.deepEqual(normalizeChatHistory("[]"), []);
  assert.deepEqual(normalizeChatHistory([{ id: "empty", messages: [] }]), []);
});
