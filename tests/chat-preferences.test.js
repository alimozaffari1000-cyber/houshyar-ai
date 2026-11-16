import test from "node:test";
import assert from "node:assert/strict";
import { normalizeChatPreferences, readChatPreferences, saveChatPreferences } from "../src/chat-preferences.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); }
  };
}

test("chat preferences use safe defaults for missing or malformed data", () => {
  assert.deepEqual(normalizeChatPreferences(null), { provider: "auto", mode: "auto", compare: false, googleSearch: false });
  assert.deepEqual(normalizeChatPreferences({ provider: "unknown", mode: "turbo", compare: "yes" }), {
    provider: "auto", mode: "auto", compare: false
  });
});

test("chat preferences preserve valid provider, response mode and comparison choice", () => {
  const storage = memoryStorage();
  const preferences = { provider: "gemini", mode: "deep", compare: true, googleSearch: true };
  assert.equal(saveChatPreferences(preferences, storage), true);
  assert.deepEqual(readChatPreferences(storage), preferences);
});

test("chat preferences reject invalid values independently", () => {
  assert.deepEqual(normalizeChatPreferences({ provider: "openai", mode: "invalid", compare: true }), {
    provider: "openai", mode: "auto", compare: true
  });
});

test("storage failures do not break chat startup or preference changes", () => {
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.deepEqual(readChatPreferences(broken), { provider: "auto", mode: "auto", compare: false });
  assert.equal(saveChatPreferences({ provider: "groq", mode: "fast", compare: false }, broken), false);
});

test("Google Search grounding preference is opt-in and validated", () => {
  assert.equal(normalizeChatPreferences({ provider: "gemini", googleSearch: true }).googleSearch, true);
  assert.equal(normalizeChatPreferences({ provider: "groq", googleSearch: "yes" }).googleSearch, false);
});
