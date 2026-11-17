import { getSessionUser } from "../_lib/auth.js";
import { onRequestGet as getReadiness } from "../health/ready.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  }
});

// Administrative diagnostics are restricted to an authenticated admin session.
export async function onRequestGet({ request, env = {} } = {}) {
  if (env.AUTH_ENABLED !== "true" || !env.DB) {
    return json({ error: "ADMIN_DIAGNOSTICS_UNAVAILABLE" }, 503);
  }

  let user;
  try {
    user = await getSessionUser(env.DB, request);
  } catch {
    return json({ error: "ADMIN_DIAGNOSTICS_UNAVAILABLE" }, 503);
  }

  if (!user) return json({ error: "AUTH_REQUIRED" }, 401);
  if (user.role !== "admin") return json({ error: "ADMIN_REQUIRED" }, 403);

  const readiness = await getReadiness({ env });
  const report = await readiness.json();
  return json({
    service: report.service,
    status: report.status,
    checks: report.checks,
    timestamp: report.timestamp
  }, readiness.status);
}
