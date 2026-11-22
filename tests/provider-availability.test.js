import test from "node:test";
import assert from "node:assert/strict";
import { applyProviderAvailability, loadProviderAvailability } from "../src/provider-availability.js";

function makeSelect() {
  return {
    options: ["auto", "groq", "anthropic", "google", "deepseek", "cloudflare_ai"].map(value => ({
      value,
      textContent: value.toUpperCase(),
      disabled: false,
      dataset: {}
    }))
  };
}

test("disables providers that are not configured and keeps automatic selection enabled", () => {
  const select = makeSelect();
  applyProviderAvailability(select, [
    { id: "groq", available: true },
    { id: "anthropic", available: false },
    { id: "google", available: false },
    { id: "deepseek", available: false },
    { id: "cloudflare_ai", available: false }
  ]);
  assert.equal(select.options[0].disabled, false);
  assert.equal(select.options[1].disabled, false);
  assert.equal(select.options[2].disabled, true);
  assert.match(select.options[2].textContent, /راه‌اندازی نشده/);
});

test("provider labels do not accumulate unavailable suffixes across refreshes", () => {
  const select = makeSelect();
  const providers = [{ id: "groq", available: false }];
  applyProviderAvailability(select, providers);
  applyProviderAvailability(select, providers);
  assert.equal(select.options[1].textContent, "GROQ — راه‌اندازی نشده");
});

test("loads provider availability from the chat status endpoint", async () => {
  const select = makeSelect();
  const fetcher = async (url, options) => {
    assert.equal(url, "/api/chat");
    assert.equal(options.method, "GET");
    return { ok: true, json: async () => ({ providers: [{ id: "cloudflare_ai", available: true }] }) };
  };
  assert.equal(await loadProviderAvailability(select, fetcher), true);
  assert.equal(select.options[5].disabled, false);
});

test("keeps the interface usable when provider status cannot be fetched", async () => {
  const select = makeSelect();
  assert.equal(await loadProviderAvailability(select, async () => { throw new Error("offline"); }), false);
  assert.equal(select.options.every(option => option.disabled === false), true);
});
