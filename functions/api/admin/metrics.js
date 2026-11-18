import { getSessionUser } from "../_lib/auth.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  }
});

export async function onRequestGet({ request, env = {} } = {}) {
  if (env.AUTH_ENABLED !== "true" || !env.DB) return json({ error: "ADMIN_DIAGNOSTICS_UNAVAILABLE" }, 503);
  let user;
  try { user = await getSessionUser(env.DB, request); } catch { return json({ error: "ADMIN_DIAGNOSTICS_UNAVAILABLE" }, 503); }
  if (!user) return json({ error: "AUTH_REQUIRED" }, 401);
  if (user.role !== "admin") return json({ error: "ADMIN_REQUIRED" }, 403);
  if (env.OBSERVABILITY_ENABLED !== "true") return json({ status: "disabled", windowHours: 24, providers: [], totals: { requests: 0, failures: 0 } });
  try {
    const since = Math.floor(Date.now() / 1000) - 24 * 3600;
    const result = await env.DB.prepare(
      "SELECT provider, COUNT(*) AS requests, SUM(CASE WHEN event IN ('provider_success','comparison_success') THEN 1 ELSE 0 END) AS successes, SUM(CASE WHEN event IN ('provider_failure','comparison_failure') THEN 1 ELSE 0 END) AS failures, AVG(elapsed_ms) AS avg_latency_ms, MAX(elapsed_ms) AS max_latency_ms FROM operational_metrics WHERE created_at >= ? GROUP BY provider ORDER BY provider"
    ).bind(since).all();
    const rows = Array.isArray(result?.results) ? result.results : [];
    const providers = rows.map(row => ({
      provider: row.provider,
      requests: Number(row.requests) || 0,
      successes: Number(row.successes) || 0,
      failures: Number(row.failures) || 0,
      failureRatePercent: Number(row.requests) > 0 ? Math.round((Number(row.failures) || 0) / Number(row.requests) * 1000) / 10 : 0,
      avgLatencyMs: Math.round(Number(row.avg_latency_ms) || 0),
      maxLatencyMs: Number(row.max_latency_ms) || 0
    }));
    return json({
      status: "ready",
      windowHours: 24,
      providers,
      totals: {
        requests: providers.reduce((sum, row) => sum + row.requests, 0),
        failures: providers.reduce((sum, row) => sum + row.failures, 0)
      },
      timestamp: new Date().toISOString()
    });
  } catch {
    return json({ status: "unavailable", windowHours: 24, providers: [], totals: { requests: 0, failures: 0 } }, 503);
  }
}
