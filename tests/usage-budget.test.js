import test from "node:test";
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
  const db = { prepare(value) { sql = value; return { bind(...values) { args = values; return { async first() { return { id: "reservation-1" }; } }; } }; } };
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
