import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRewardPool, distributeRewardPool, DEFAULT_REWARD_RATE_BPS } from '../src/ads/rewards.js';

test('default reward pool is five percent of settled net revenue', () => {
  assert.equal(DEFAULT_REWARD_RATE_BPS, 500);
  assert.equal(calculateRewardPool(100_000), 5_000);
});

test('reward pool uses integer floor rounding and supports configured rates', () => {
  assert.equal(calculateRewardPool(999, 500), 49);
  assert.equal(calculateRewardPool(999, 0), 0);
  assert.equal(calculateRewardPool(999, 10_000), 999);
});

test('rejects invalid revenue and rate values', () => {
  assert.throws(() => calculateRewardPool(-1), TypeError);
  assert.throws(() => calculateRewardPool(1.5), TypeError);
  assert.throws(() => calculateRewardPool(100, 10_001), RangeError);
});

test('distributes pool proportionally and deterministically', () => {
  const participants = [{ userId: 'u2', weight: 1 }, { userId: 'u1', weight: 2 }];
  const first = distributeRewardPool(10, participants);
  assert.deepEqual(first, [{ userId: 'u1', rewardUnits: 7 }, { userId: 'u2', rewardUnits: 3 }]);
  assert.deepEqual(distributeRewardPool(10, [...participants].reverse()), first);
  assert.equal(first.reduce((sum, item) => sum + item.rewardUnits, 0), 10);
});

test('uses exact integer arithmetic near safe-integer limits', () => {\n  const maximum = Number.MAX_SAFE_INTEGER;\n  assert.equal(calculateRewardPool(maximum, 500), Number((BigInt(maximum) * 500n) / 10_000n));\n  const shares = distributeRewardPool(maximum, [{ userId: 'a', weight: maximum }, { userId: 'b', weight: maximum - 1 }]);\n  assert.equal(shares.reduce((sum, item) => sum + item.rewardUnits, 0), maximum);\n});\n\ntest('handles empty and zero pools', () => {
  assert.deepEqual(distributeRewardPool(10, []), []);
  assert.deepEqual(distributeRewardPool(0, [{ userId: 'u1', weight: 1 }]), [{ userId: 'u1', rewardUnits: 0 }]);
});

test('rejects duplicate users and invalid weights', () => {
  assert.throws(() => distributeRewardPool(10, [{ userId: 'u1', weight: 1 }, { userId: 'u1', weight: 2 }]), TypeError);
  assert.throws(() => distributeRewardPool(10, [{ userId: 'u1', weight: 0 }]), RangeError);
});
