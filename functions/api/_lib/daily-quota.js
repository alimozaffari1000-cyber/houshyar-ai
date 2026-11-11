const DAY_SECONDS = 86400;
export function dailyQuotaLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 20;
  return Math.max(1, Math.min(500, Math.floor(parsed)));
}
export async function reserveDailyChat({ db, userId, limit, now = Math.floor(Date.now() / 1000) }) {
  if (!db || !userId) throw new Error("QUOTA_STORAGE_UNAVAILABLE");
  const quota = dailyQuotaLimit(limit);
  const day = new Date(now * 1000).toISOString().slice(0, 10);
  const resetAt = Math.floor(Date.parse(day + "T00:00:00.000Z") / 1000) + DAY_SECONDS;
  const result = await db.prepare(
    "INSERT INTO daily_usage (user_id, usage_date, request_count, updated_at) VALUES (?, ?, 1, ?) " +
    "ON CONFLICT(user_id, usage_date) DO UPDATE SET request_count = request_count + 1, updated_at = excluded.updated_at " +
    "WHERE daily_usage.request_count < ? RETURNING request_count"
  ).bind(userId, day, now, quota).first();
  return { allowed: Boolean(result), used: result?.request_count ?? quota, limit: quota, resetAt, usageDate: day };
}
export async function releaseDailyChat({ db, userId, usageDate = new Date().toISOString().slice(0, 10), now = Math.floor(Date.now() / 1000) }) {
  if (!db || !userId) return;
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(usageDate)) throw new Error("INVALID_USAGE_DATE");
  await db.prepare(
    "UPDATE daily_usage SET request_count = CASE WHEN request_count > 0 THEN request_count - 1 ELSE 0 END, updated_at = ? WHERE user_id = ? AND usage_date = ?"
  ).bind(now, userId, usageDate).run();
}