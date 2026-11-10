import { requireAdsUser, adJson, readAdsJson } from "../_lib/ads.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireAdsUser({ request, env });
  if (auth.response) return auth.response;
  if (auth.user.role !== "admin") return adJson({ error: "FORBIDDEN" }, 403);
  try {
    const rows = await env.DB.prepare(
      "SELECT e.id, e.campaign_id, c.title AS campaign_title, e.event_type, e.risk_score, e.fraud_reason, e.occurred_at " +
      "FROM ad_events e JOIN ad_campaigns c ON c.id = e.campaign_id " +
      "WHERE e.validation_status IN ('pending', 'review') ORDER BY e.risk_score DESC, e.occurred_at ASC LIMIT 100"
    ).all();
    return adJson({ events: rows.results || [] });
  } catch { return adJson({ error: "AD_EVENT_QUEUE_UNAVAILABLE" }, 503); }
}

function validId(value) { return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value); }

export async function onRequestPost({ request, env }) {
  const auth = await requireAdsUser({ request, env, write: true });
  if (auth.response) return auth.response;
  if (auth.user.role !== "admin") return adJson({ error: "FORBIDDEN" }, 403);
  const parsed = await readAdsJson(request, 4096);
  if (parsed.error) return adJson({ error: parsed.error }, 400);
  const { eventId, decision, reason = "" } = parsed.body;
  if (!validId(eventId) || !["valid", "rejected", "review"].includes(decision) ||
      typeof reason !== "string" || reason.length > 500) return adJson({ error: "INVALID_EVENT_REVIEW" }, 400);
  const now = Math.floor(Date.now() / 1000);
  const auditId = crypto.randomUUID();
  try {
    const results = await env.DB.batch([
      env.DB.prepare(
        "UPDATE ad_events SET validation_status = ?, validated_by = ?, validation_reason = ?, validated_at = ? " +
        "WHERE id = ? AND validation_status IN ('pending', 'review')"
      ).bind(decision, auth.user.id, reason.trim() || null, now, eventId),
      env.DB.prepare(
        "INSERT INTO audit_events (id, actor_user_id, event_type, target_type, target_id, metadata_json, created_at) " +
        "SELECT ?, ?, 'ad_event_reviewed', 'ad_event', ?, ?, ? WHERE EXISTS (" +
        "SELECT 1 FROM ad_events WHERE id = ? AND validation_status = ? AND validated_by = ? AND validated_at = ?)"
      ).bind(auditId, auth.user.id, eventId, JSON.stringify({ decision, reason: reason.trim().slice(0, 500) }), now, eventId, decision, auth.user.id, now)
    ]);
    if (!results[0]?.meta?.changes) return adJson({ error: "EVENT_NOT_REVIEWABLE" }, 409);
    if (!results[1]?.meta?.changes) return adJson({ error: "EVENT_AUDIT_FAILED" }, 503);
    return adJson({ reviewed: true, eventId, validationStatus: decision, rewardIssued: false });
  } catch { return adJson({ error: "EVENT_REVIEW_FAILED" }, 503); }
}
