import { getSessionUser, originAllowed } from "./_lib/auth.js";
import { authJson, readAuthBody, enforceAuthRateLimit } from "./_lib/auth-flow.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function onRequestGet({ request, env }) {
  if (!env.DB) return authJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  const user = await getSessionUser(env.DB, request);
  if (!user) return authJson({ error: "AUTH_REQUIRED" }, 401);
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(50, Number.parseInt(url.searchParams.get("limit") || "20", 10) || 20));
  try {
    const result = await env.DB.prepare(
      "SELECT id, kind, title, body, entity_type AS entityType, entity_id AS entityId, created_at AS createdAt, read_at AS readAt " +
      "FROM user_notifications WHERE recipient_user_id = ? ORDER BY created_at DESC LIMIT ?"
    ).bind(user.id, limit).all();
    const unread = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM user_notifications WHERE recipient_user_id = ? AND read_at IS NULL"
    ).bind(user.id).first();
    return authJson({ notifications: Array.isArray(result.results) ? result.results : [], unreadCount: Number(unread?.count || 0) });
  } catch {
    return authJson({ error: "NOTIFICATIONS_UNAVAILABLE" }, 503);
  }
}

export async function onRequestPatch({ request, env }) {
  if (!env.DB) return authJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  if (!originAllowed(request)) return authJson({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const user = await getSessionUser(env.DB, request);
  if (!user) return authJson({ error: "AUTH_REQUIRED" }, 401);
  const limited = await enforceAuthRateLimit({ env, request, action: "notifications-read", email: user.email, limit: 30 });
  if (limited) return limited;
  const parsed = await readAuthBody(request);
  if (parsed.error) return authJson({ error: parsed.error }, parsed.status);
  const ids = parsed.body?.ids;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 50 || ids.some(id => typeof id !== "string" || !uuidPattern.test(id))) {
    return authJson({ error: "INVALID_NOTIFICATION_IDS" }, 400);
  }
  try {
    const now = Math.floor(Date.now() / 1000);
    const result = await env.DB.prepare(
      "UPDATE user_notifications SET read_at = ? WHERE recipient_user_id = ? AND read_at IS NULL AND id IN (" +
      ids.map(() => "?").join(", ") + ")"
    ).bind(now, user.id, ...ids).run();
    return authJson({ updated: result?.meta?.changes ?? 0 });
  } catch {
    return authJson({ error: "NOTIFICATIONS_UPDATE_FAILED" }, 503);
  }
}
