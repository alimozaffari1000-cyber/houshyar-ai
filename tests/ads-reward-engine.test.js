import test from "node:test";
import assert from "node:assert/strict";
import { calculateRewardPool, distributeRewardPool } from "../src/ads/reward-engine.js";

test("reward pool is exactly five percent of net settled revenue by default", () => {
  assert.equal(calculateRewardPool(10001), 500);
  assert.equal(calculateRewardPool(10000, 250), 250);
});
test("reward pool rejects non-integer or negative money values", () => {
  assert.throws(() => calculateRewardPool(-1), /NET_REVENUE/);
  assert.throws(() => calculateRewardPool(1.2), /NET_REVENUE/);
  assert.throws(() => calculateRewardPool(100, 10001), /INVALID_REWARD_RATE/);
});
test("distribution is deterministic, unique and never exceeds the pool", () => {
  const result = distributeRewardPool(10, ["u3", "u1", "u2", "u1"]);
  assert.deepEqual(result, [
    { userId: "u1", amountUnits: 4 },
    { userId: "u2", amountUnits: 3 },
    { userId: "u3", amountUnits: 3 }
  ]);
  assert.equal(result.reduce((sum, item) => sum + item.amountUnits, 0), 10);
});
