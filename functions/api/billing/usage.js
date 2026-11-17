import { getSessionUser } from "../_lib/auth.js";
import { authJson } from "../_lib/auth-flow.js";
export async function onRequestGet({ request, env }) {
  if (!env.DB) return authJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  const user = await getSessionUser(env.DB, request);
  if (!user) return authJson({ error: "AUTH_REQUIRED" }, 401);
  const url = new URL(request.url);
  const days = Math.max(1, Math.min(90, Number.parseInt(url.searchParams.get("days") || "30", 10) || 30));
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  try {
    const [summary, providers, recent] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS request_count, COALESCE(SUM(total_tokens), 0) AS total_tokens, COALESCE(SUM(estimated_cost_micro_usd), 0) AS estimated_cost_micro_usd, SUM(CASE WHEN estimated_cost_micro_usd IS NULL THEN 1 ELSE 0 END) AS unpriced_requests FROM ai_usage_events WHERE user_id = ? AND created_at >= ?").bind(user.id, since).first(),
      env.DB.prepare("SELECT provider_code, COUNT(*) AS request_count, COALESCE(SUM(total_tokens), 0) AS total_tokens, COALESCE(SUM(estimated_cost_micro_usd), 0) AS estimated_cost_micro_usd FROM ai_usage_events WHERE user_id = ? AND created_at >= ? GROUP BY provider_code ORDER BY request_count DESC").bind(user.id, since).all(),
      env.DB.prepare("SELECT request_id, provider_code, model_code, prompt_tokens, completion_tokens, total_tokens, estimated_cost_micro_usd, web_search_used, created_at FROM ai_usage_events WHERE user_id = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 50").bind(user.id, since).all()
    ]);
    return authJson({
      periodDays: days,
      summary: { requests: summary?.request_count || 0, totalTokens: summary?.total_tokens || 0, estimatedCostMicroUsd: summary?.estimated_cost_micro_usd || 0, unpricedRequests: summary?.unpriced_requests || 0 },
      providers: providers?.results || [],
      recent: recent?.results || []
    });
  } catch { return authJson({ error: "USAGE_REPORT_UNAVAILABLE" }, 503); }
}
