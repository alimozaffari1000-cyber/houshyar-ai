import { requireAdsUser, adJson, readAdsJson } from "../_lib/ads.js";

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
  try {
    const result = await env.DB.prepare(
      "UPDATE ad_events SET validation_status = ?, validated_by = ?, validation_reason = ?, validated_at = ? " +
      "WHERE id = ? AND validation_status IN ('pending', 'review')"
    ).bind(decision, auth.user.id, reason.trim() || null, now, eventId).run();
    if (!result.meta?.changes) return adJson({ error: "EVENT_NOT_REVIEWABLE" }, 409);
    await env.DB.prepare(
      "INSERT INTO audit_events (id, actor_user_id, event_type, target_type, target_id, metadata_json, created_at) VALUES (?, ?, 'ad_event_reviewed', 'ad_event', ?, ?, ?)"
    ).bind(crypto.randomUUID(), auth.user.id, eventId, JSON.stringify({ decision, reason: reason.trim().slice(0, 500) }), now).run();
    return adJson({ reviewed: true, eventId, validationStatus: decision, rewardIssued: false });
  } catch { return adJson({ error: "EVENT_REVIEW_FAILED" }, 503); }
}
