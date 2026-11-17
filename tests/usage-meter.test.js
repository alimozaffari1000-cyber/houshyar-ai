import test from "node:test";
import assert from "node:assert/strict";
import { estimateUsageCostMicroUsd, getProviderRates, recordAiUsage } from "../functions/api/_lib/usage-meter.js";
test("usage cost is calculated in integer micro-USD from token counts", () => {
  assert.equal(estimateUsageCostMicroUsd({ promptTokens: 1000000, completionTokens: 500000, inputRate: 2000000, outputRate: 4000000 }), 4000000);
  assert.equal(estimateUsageCostMicroUsd({ promptTokens: 100, completionTokens: 20, inputRate: 0, outputRate: 0 }), 0);
  assert.equal(estimateUsageCostMicroUsd({ promptTokens: 1, completionTokens: 1, inputRate: "unknown", outputRate: 1 }), null);
  assert.equal(estimateUsageCostMicroUsd({ promptTokens: -1, completionTokens: 1, inputRate: 1, outputRate: 1 }), null);
});
test("provider rates use provider-specific server configuration", () => {
  assert.deepEqual(getProviderRates({ GEMINI_INPUT_MICRO_USD_PER_MILLION: "100", GEMINI_OUTPUT_MICRO_USD_PER_MILLION: "200" }, "google"), { inputRate: 100, outputRate: 200 });
  assert.deepEqual(getProviderRates({ GROQ_INPUT_MICRO_USD_PER_MILLION: "10" }, "groq"), { inputRate: 10, outputRate: null });
});
test("usage events are written with user ownership and unique request id", async () => {
  let captured;
  const db = { prepare(sql) { return { bind(...args) { captured = { sql, args }; return { run: async () => ({ success: true }) }; } }; } };
  const result = await recordAiUsage({ db, userId: "user-1", provider: "google", model: "gemini-test", usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, requestId: "req-1", webSearch: true, rates: { inputRate: 1000000, outputRate: 2000000 }, now: 123 });
  assert.equal(captured.args[1], "user-1");
  assert.equal(captured.args[2], "req-1");
  assert.equal(captured.args[9], 1);
  assert.equal(captured.args[10], 123);
  assert.equal(result.totalTokens, 15);
  assert.equal(result.estimatedCostMicroUsd, 20);
});
