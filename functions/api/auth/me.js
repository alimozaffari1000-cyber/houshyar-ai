import { getSessionUser } from "../_lib/auth.js";
import { dailyQuotaLimit } from "../_lib/daily-quota.js";
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
export async function onRequestGet({ request, env }) {
  if (env.AUTH_ENABLED !== "true" || !env.DB) return json({ error: "AUTH_NOT_CONFIGURED" }, 503);
  const user = await getSessionUser(env.DB, request);
  if (!user) return json({ authenticated: false }, 200);
  let quota = { enabled: false };
  if (env.CHAT_QUOTA_ENABLED === "true") {
    try {
      const now = Math.floor(Date.now() / 1000);
      const day = new Date(now * 1000).toISOString().slice(0, 10);
      const limit = dailyQuotaLimit(env.FREE_DAILY_CHAT_LIMIT);
      const row = await env.DB.prepare("SELECT request_count FROM daily_usage WHERE user_id = ? AND usage_date = ? LIMIT 1").bind(user.id, day).first();
      const used = Number(row?.request_count || 0);
      quota = { enabled: true, limit, used, remaining: Math.max(0, limit - used), resetAt: Math.floor(Date.parse(day + "T00:00:00.000Z") / 1000) + 86400 };
    } catch {
      return json({ error: "QUOTA_STATUS_UNAVAILABLE" }, 503);
    }
  }
  return json({ authenticated: true, user, quota });
}
