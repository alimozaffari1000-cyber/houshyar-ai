import test from "node:test";
import { readFile } from "node:fs/promises";
import { recordAiUsage } from "../functions/api/_lib/usage-meter.js";
import assert from "node:assert/strict";
import { estimateMaximumRequestCost, parseDailySpendCap, reserveAiBudget, releaseAiBudget } from "../functions/api/_lib/usage-budget.js";

test("daily spend cap accepts only positive safe integer micro-USD values", () => {
  assert.equal(parseDailySpendCap("2500000"), 2500000);
  assert.equal(parseDailySpendCap("0"), null);
  assert.equal(parseDailySpendCap("-1"), null);
  assert.equal(parseDailySpendCap("1.5"), null);
  assert.equal(parseDailySpendCap(""), null);
});

test("maximum reservation includes a conservative input bound and full output allowance", () => {
  assert.equal(estimateMaximumRequestCost({ promptBytes: 100, maxOutputTokens: 10, inputRate: 1000000, outputRate: 2000000 }), 220);
  assert.equal(estimateMaximumRequestCost({ promptBytes: 10, inputRate: null, outputRate: 10 }), null);
});

test("budget reservation uses one conditional insert and fails closed for unknown rates", async () => {
  let sql, args;
  const db = { prepare(value) { sql = value; return { bind(...values) { args = values; return { async run() { return { success: true }; }, async first() { return { id: "reservation-1" }; } }; } }; } };
  const result = await reserveAiBudget({ db, userId: "u1", requestId: "r1", capMicroUsd: 1000000, promptBytes: 100, rates: { inputRate: 1000000, outputRate: 2000000 }, now: 1700000000 });
  assert.equal(result.allowed, true);
  assert.match(sql, /INSERT INTO ai_usage_budget_reservations/);
  assert.match(sql, /estimated_cost_micro_usd IS NULL/);
  assert.equal(args[1], "u1");
  assert.equal(args[2], "r1");
  const blocked = await reserveAiBudget({ db, userId: "u1", requestId: "r2", capMicroUsd: 1000000, promptBytes: 100, rates: { inputRate: null, outputRate: 2000000 } });
  assert.equal(blocked.reason, "BUDGET_CONFIGURATION_REQUIRED");
});

test("reservation release deletes only the supplied reservation id", async () => {
  let captured;
  const db = { prepare(sql) { return { bind(id) { captured = { sql, id }; return { run: async () => ({ success: true }) }; } }; } };
  await releaseAiBudget({ db, reservationId: "res-1" });
  assert.match(captured.sql, /DELETE FROM ai_usage_budget_reservations WHERE id = \?/);
  assert.equal(captured.id, "res-1");
});

test("chat spend guard is opt-in and blocks unsupported compare and web-search cost paths", async () => {
  const chat = await readFile(new URL("../functions/api/chat.js", import.meta.url), "utf8");
  assert.match(chat, /AI_SPEND_GUARD_ENABLED/);
  assert.match(chat, /AI_DAILY_SPEND_CAP_MICRO_USD/);
  assert.match(chat, /COMPARE_NOT_AVAILABLE_WITH_SPEND_GUARD/);
  assert.match(chat, /SEARCH_COST_NOT_COVERED/);
  assert.match(chat, /reserveAiBudget/);
});

test("settling a spend reservation writes usage and deletes reservation atomically", async () => {
  let batch;
  const db = {
    prepare(sql) {
      return { sql, bind(...args) { return { sql, args, run: async () => ({ success: true }) }; } };
    },
    async batch(statements) { batch = statements; return [{ success: true }, { success: true }]; }
  };
  const result = await recordAiUsage({
    db, userId: "u1", provider: "groq", model: "test-model",
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    requestId: "r-budget", reservationId: "res-1",
    rates: { inputRate: 1000000, outputRate: 2000000 }, now: 1700000000
  });
  assert.equal(result.estimatedCostMicroUsd, 20);
  assert.equal(batch.length, 2);
  assert.match(batch[0].sql, /INSERT INTO ai_usage_events/);
  assert.match(batch[1].sql, /DELETE FROM ai_usage_budget_reservations/);
  assert.deepEqual(batch[1].args, ["res-1"]);
});

test("unknown provider usage is recorded as unpriced and still clears the reservation atomically", async () => {
  let batch;
  const db = {
    prepare(sql) { return { sql, bind(...args) { return { sql, args, run: async () => ({ success: true }) }; } }; },
    async batch(statements) { batch = statements; return [{ success: true }, { success: true }]; }
  };
  const result = await recordAiUsage({
    db, userId: "u1", provider: "google", model: "test-model",
    usage: null, requestId: "r-unknown", reservationId: "res-2",
    rates: { inputRate: 1000000, outputRate: 2000000 }, now: 1700000000
  });
  assert.equal(result.estimatedCostMicroUsd, null);
  assert.equal(batch.length, 2);
});
