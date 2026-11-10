// Deterministic service-credit pool calculation. This module never issues credits.
export function calculateRewardPool(netSettledRevenueMinor, rewardRateBps = 500) {
  if (!Number.isSafeInteger(netSettledRevenueMinor) || netSettledRevenueMinor < 0) {
    throw new TypeError("NET_REVENUE_MUST_BE_NON_NEGATIVE_INTEGER");
  }
  if (!Number.isInteger(rewardRateBps) || rewardRateBps < 0 || rewardRateBps > 10000) {
    throw new TypeError("INVALID_REWARD_RATE");
  }
  return Math.floor(netSettledRevenueMinor * rewardRateBps / 10000);
}

export function distributeRewardPool(poolUnits, eligibleUsers) {
  if (!Number.isSafeInteger(poolUnits) || poolUnits < 0) throw new TypeError("INVALID_POOL");
  if (!Array.isArray(eligibleUsers)) throw new TypeError("INVALID_ELIGIBLE_USERS");
  const users = [...new Set(eligibleUsers.filter(value => typeof value === "string" && value.length > 0))].sort();
  if (!users.length || poolUnits === 0) return [];
  const base = Math.floor(poolUnits / users.length);
  let remainder = poolUnits % users.length;
  return users.map(userId => ({ userId, amountUnits: base + (remainder-- > 0 ? 1 : 0) })).filter(item => item.amountUnits > 0);
}
