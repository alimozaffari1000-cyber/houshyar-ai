const DEFAULT_REWARD_RATE_BPS = 500;
const BASIS_POINTS = 10_000;

function requireSafeNonNegativeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a safe non-negative integer`);
  }
}

/**
 * Calculates the user reward pool from settled net advertising revenue.
 * Amounts are integer service-credit units, never floating-point currency.
 */
export function calculateRewardPool(netRevenueUnits, rateBps = DEFAULT_REWARD_RATE_BPS) {
  requireSafeNonNegativeInteger(netRevenueUnits, 'netRevenueUnits');
  if (!Number.isSafeInteger(rateBps) || rateBps < 0 || rateBps > BASIS_POINTS) {
    throw new RangeError('rateBps must be an integer between 0 and 10000');
  }
  return Math.floor((netRevenueUnits * rateBps) / BASIS_POINTS);
}

/**
 * Splits a reward pool proportionally by verified activity weights.
 * Remainder units are assigned by descending fractional remainder, then user id,
 * making the result deterministic and ensuring allocations never exceed the pool.
 */
export function distributeRewardPool(poolUnits, participants) {
  requireSafeNonNegativeInteger(poolUnits, 'poolUnits');
  if (!Array.isArray(participants)) throw new TypeError('participants must be an array');

  const seen = new Set();
  const eligible = participants.map(({ userId, weight }) => {
    if (typeof userId !== 'string' || !userId.trim()) throw new TypeError('userId is required');
    if (seen.has(userId)) throw new TypeError('duplicate userId');
    seen.add(userId);
    if (!Number.isSafeInteger(weight) || weight <= 0) throw new RangeError('weight must be a positive safe integer');
    return { userId, weight };
  });

  const totalWeight = eligible.reduce((sum, item) => sum + item.weight, 0);
  if (!Number.isSafeInteger(totalWeight)) throw new RangeError('total weight exceeds safe integer range');
  if (eligible.length === 0 || poolUnits === 0) {
    return eligible.map(({ userId }) => ({ userId, rewardUnits: 0 }));
  }

  const shares = eligible.map(({ userId, weight }) => {
    const exact = (poolUnits * weight) / totalWeight;
    const base = Math.floor(exact);
    return { userId, rewardUnits: base, remainder: exact - base };
  });
  let remaining = poolUnits - shares.reduce((sum, item) => sum + item.rewardUnits, 0);
  const ranked = [...shares].sort((a, b) => b.remainder - a.remainder || a.userId.localeCompare(b.userId));
  for (let index = 0; index < remaining; index += 1) ranked[index].rewardUnits += 1;

  return shares
    .map(({ userId, rewardUnits }) => ({ userId, rewardUnits }))
    .sort((a, b) => a.userId.localeCompare(b.userId));
}

export { DEFAULT_REWARD_RATE_BPS };
