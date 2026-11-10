import { requireAdsUser, adJson, readAdsJson } from "../_lib/ads.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireAdsUser({ request, env });
  if (auth.response) return auth.response;
  if (auth.user.role !== "admin") return adJson({ error: "FORBIDDEN" }, 403);
  try {
    const rows = await env.DB.prepare("SELECT id, advertiser_user_id, title, creative_payload, destination_url, pricing_model, budget_minor, currency_code, created_at FROM ad_campaigns WHERE status = 'pending_review' ORDER BY created_at ASC LIMIT 100").all();
    return adJson({ pending: rows.results || [] });
  } catch { return adJson({ error: "REVIEW_QUEUE_UNAVAILABLE" }, 503); }
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAdsUser({ request, env, write: true });
  if (auth.response) return auth.response;
  if (auth.user.role !== "admin") return adJson({ error: "FORBIDDEN" }, 403);
  const parsed = await readAdsJson(request, 4096);
  if (parsed.error) return adJson({ error: parsed.error }, 400);
  const { campaignId, decision, reason = "" } = parsed.body;
  if (!validId(campaignId) || !["approve", "reject"].includes(decision) || typeof reason !== "string" || reason.length > 500) {
    return adJson({ error: "INVALID_REVIEW" }, 400);
  }
  const now = Math.floor(Date.now() / 1000);
  const status = decision === "approve" ? "approved" : "rejected";
  try {
    const results = await env.DB.batch([
      env.DB.prepare("UPDATE ad_campaigns SET status = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ? AND status = 'pending_review'")
        .bind(status, auth.user.id, now, now, campaignId),
      env.DB.prepare(
        "INSERT INTO audit_events (id, actor_user_id, event_type, target_type, target_id, metadata_json, created_at) " +
        "SELECT ?, ?, ?, 'ad_campaign', ?, ?, ? WHERE EXISTS (" +
        "SELECT 1 FROM ad_campaigns WHERE id = ? AND status = ? AND reviewed_by = ? AND reviewed_at = ?)"
      ).bind(crypto.randomUUID(), auth.user.id, "ad_campaign_" + decision, campaignId, JSON.stringify({ reason }), now, campaignId, status, auth.user.id, now)
    ]);
    if (!results[0]?.meta?.changes) return adJson({ error: "CAMPAIGN_NOT_PENDING" }, 409);
    if (!results[1]?.meta?.changes) return adJson({ error: "AUDIT_WRITE_FAILED" }, 503);
    return adJson({ reviewed: true, campaignId, status });
  } catch { return adJson({ error: "REVIEW_FAILED" }, 503); }
}

function validId(value) { return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value); }
