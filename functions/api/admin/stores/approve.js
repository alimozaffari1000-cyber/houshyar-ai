import { getSessionUser, originAllowed } from "../../_lib/auth.js";
import { authJson, readAuthBody, enforceAuthRateLimit } from "../../_lib/auth-flow.js";

export async function onRequestPost({ request, env }) {
  if (!env.DB) return authJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  if (!originAllowed(request)) return authJson({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const user = await getSessionUser(env.DB, request);
  if (!user) return authJson({ error: "AUTH_REQUIRED" }, 401);
  const limited = await enforceAuthRateLimit({ env, request, action: "admin-store-approve", email: user.email, limit: 10 });
  if (limited) return limited;
  if (user.role !== "admin") return authJson({ error: "ADMIN_REQUIRED" }, 403);
  const parsed = await readAuthBody(request);
  if (parsed.error) return authJson({ error: parsed.error }, parsed.status);
  const storeId = typeof parsed.body.storeId === "string" ? parsed.body.storeId.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(storeId)) return authJson({ error: "INVALID_STORE_ID" }, 400);
  const now = Math.floor(Date.now() / 1000);
  try {
    const results = await env.DB.batch([
      env.DB.prepare("UPDATE merchant_stores SET status = 'active', updated_at = ? WHERE id = ? AND status = 'pending'").bind(now, storeId),
      env.DB.prepare("INSERT INTO audit_events (id, actor_user_id, event_type, target_type, target_id, created_at) SELECT ?, ?, 'merchant_store_approved', 'merchant_store', ?, ? WHERE EXISTS (SELECT 1 FROM merchant_stores WHERE id = ? AND status = 'active' AND updated_at = ?)").bind(crypto.randomUUID(), user.id, storeId, now, storeId, now)
    ]);
    if (!results?.[0]?.meta?.changes) return authJson({ error: "PENDING_STORE_NOT_FOUND" }, 404);
    return authJson({ approved: true, storeId });
  } catch {
    return authJson({ error: "STORE_APPROVAL_UNAVAILABLE" }, 503);
  }
}
