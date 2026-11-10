import { requireAdsUser, adJson, readAdsJson, checkAdsRateLimit } from "../_lib/ads.js";

export async function onRequestPost({ request, env }) {
  const auth = await requireAdsUser({ request, env, write: true });
  if (auth.response) return auth.response;
  if (env.ADS_EVENT_INGESTION_ENABLED !== "true") return adJson({ error: "AD_EVENT_INGESTION_DISABLED" }, 503);
  let rate;
  try { rate = await checkAdsRateLimit({ db: env.DB, request, action: "event", limit: 30 }); }
  catch { return adJson({ error: "RATE_LIMIT_UNAVAILABLE" }, 503); }
  if (!rate.allowed) return adJson({ error: "RATE_LIMITED" }, 429, { "Retry-After": String(rate.retryAfter) });
  const parsed = await readAdsJson(request, 4096);
  if (parsed.error) return adJson({ error: parsed.error }, 400);
  const { campaignId, eventType, eventKey } = parsed.body;
  if (typeof campaignId !== "string" || !/^[0-9a-f-]{36}$/i.test(campaignId) ||
      !["impression", "click"].includes(eventType) || typeof eventKey !== "string" || !/^[a-zA-Z0-9_-]{16,100}$/.test(eventKey)) {
    return adJson({ error: "INVALID_AD_EVENT" }, 400);
  }
  try {
    const campaign = await env.DB.prepare("SELECT id FROM ad_campaigns WHERE id = ? AND status = 'approved' AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at > ?) LIMIT 1")
      .bind(campaignId, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000)).first();
    if (!campaign) return adJson({ error: "CAMPAIGN_NOT_ACTIVE" }, 404);
    const dedupeKey = campaignId + ":" + eventType + ":" + eventKey;
    const eventId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const inserted = await env.DB.prepare("INSERT OR IGNORE INTO ad_events (id, campaign_id, user_id, event_type, dedupe_key, validation_status, risk_score, occurred_at) VALUES (?, ?, ?, ?, ?, 'review', 50, ?)")
      .bind(eventId, campaignId, auth.user.id, eventType, dedupeKey, now).run();
    return adJson({ accepted: true, duplicate: !inserted.meta?.changes, validationStatus: "review", rewardIssued: false }, inserted.meta?.changes ? 202 : 200);
  } catch { return adJson({ error: "AD_EVENT_UNAVAILABLE" }, 503); }
}
