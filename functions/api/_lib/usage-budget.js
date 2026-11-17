import { estimateUsageCostMicroUsd } from "./usage-meter.js";

const DAY_SECONDS = 86400;
const MAX_CAP_MICRO_USD = 1_000_000_000_000;

export function parseDailySpendCap(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= MAX_CAP_MICRO_USD ? parsed : null;
}

export function estimateMaximumRequestCost({ promptBytes, maxOutputTokens = 1200, inputRate, outputRate }) {
  if (!Number.isSafeInteger(promptBytes) || promptBytes < 0 ||
      !Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 1) return null;
  // Reserve a 2x UTF-8 byte bound for provider tokenization plus the full output limit.
  return estimateUsageCostMicroUsd({
    promptTokens: promptBytes * 2,
    completionTokens: maxOutputTokens,
    inputRate,
    outputRate
  });
}

export async function reserveAiBudget({ db, userId, requestId, capMicroUsd, promptBytes, maxOutputTokens = 1200, rates, now = Math.floor(Date.now() / 1000), reservationTtlSeconds = 120 }) {
  if (!db || !userId || !requestId) throw new Error("AI_BUDGET_STORAGE_UNAVAILABLE");
  const cap = parseDailySpendCap(capMicroUsd);
  const reserve = estimateMaximumRequestCost({ promptBytes, maxOutputTokens, ...rates });
  if (!cap || reserve == null || reserve <= 0) return { allowed: false, reason: "BUDGET_CONFIGURATION_REQUIRED" };
  if (reserve > cap) return { allowed: false, reason: "REQUEST_EXCEEDS_DAILY_BUDGET", capMicroUsd: cap };
  const day = new Date(now * 1000).toISOString().slice(0, 10);
  const dayStart = Math.floor(Date.parse(day + "T00:00:00.000Z") / 1000);
  const dayEnd = dayStart + DAY_SECONDS;
  const id = crypto.randomUUID();
  const row = await db.prepare(
    "INSERT INTO ai_usage_budget_reservations (id, user_id, request_id, usage_date, reserved_cost_micro_usd, expires_at, created_at) " +
    "SELECT ?, ?, ?, ?, ?, ?, ? " +
    "WHERE NOT EXISTS (SELECT 1 FROM ai_usage_events WHERE user_id = ? AND created_at >= ? AND created_at < ? AND estimated_cost_micro_usd IS NULL) " +
    "AND (SELECT COALESCE(SUM(estimated_cost_micro_usd), 0) FROM ai_usage_events WHERE user_id = ? AND created_at >= ? AND created_at < ?) + " +
    "(SELECT COALESCE(SUM(reserved_cost_micro_usd), 0) FROM ai_usage_budget_reservations WHERE user_id = ? AND usage_date = ? AND expires_at > ?) + ? <= ? " +
    "RETURNING id"
  ).bind(id, userId, requestId, day, reserve, now + reservationTtlSeconds, now,
    userId, dayStart, dayEnd, userId, dayStart, dayEnd, userId, day, now, reserve, cap).first();
  return row ? { allowed: true, id, requestId, usageDate: day, reservedCostMicroUsd: reserve, capMicroUsd: cap } :
    { allowed: false, reason: "DAILY_SPEND_CAP_REACHED", capMicroUsd: cap };
}

export async function releaseAiBudget({ db, reservationId }) {
  if (!db || !reservationId) return;
  await db.prepare("DELETE FROM ai_usage_budget_reservations WHERE id = ?").bind(reservationId).run();
}
