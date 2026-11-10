import { requireAdsUser, adJson, readAdsJson, checkAdsRateLimit, safeHttpsUrl, validText } from "../_lib/ads.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireAdsUser({ request, env });
  if (auth.response) return auth.response;
  try {
    const rows = auth.user.role === "admin"
      ? await env.DB.prepare("SELECT id, advertiser_user_id, title, destination_url, pricing_model, budget_minor, currency_code, status, starts_at, ends_at, created_at FROM ad_campaigns ORDER BY created_at DESC LIMIT 100").all()
      : await env.DB.prepare("SELECT id, title, destination_url, pricing_model, budget_minor, currency_code, status, starts_at, ends_at, created_at FROM ad_campaigns WHERE advertiser_user_id = ? ORDER BY created_at DESC LIMIT 50").bind(auth.user.id).all();
    return adJson({ campaigns: rows.results || [] });
  } catch { return adJson({ error: "CAMPAIGNS_UNAVAILABLE" }, 503); }
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAdsUser({ request, env, write: true });
  if (auth.response) return auth.response;
  let rate;
  try { rate = await checkAdsRateLimit({ db: env.DB, request, action: "campaign-create", limit: 5 }); }
  catch { return adJson({ error: "RATE_LIMIT_UNAVAILABLE" }, 503); }
  if (!rate.allowed) return adJson({ error: "RATE_LIMITED" }, 429, { "Retry-After": String(rate.retryAfter) });
  const parsed = await readAdsJson(request);
  if (parsed.error) return adJson({ error: parsed.error }, parsed.error === "BODY_TOO_LARGE" ? 413 : 400);
  const body = parsed.body;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const destinationUrl = safeHttpsUrl(body.destinationUrl);
  const pricingModel = ["cpm", "cpc", "cpa", "barter"].includes(body.pricingModel) ? body.pricingModel : null;
  const budgetMinor = body.budgetMinor === undefined ? 0 : body.budgetMinor;
  const currencyCode = typeof body.currencyCode === "string" ? body.currencyCode.toUpperCase() : "USD";
  const startsAt = body.startsAt == null ? null : body.startsAt;
  const endsAt = body.endsAt == null ? null : body.endsAt;
  if (!validText(title, 100) || !validText(description, 2000, 1) || !destinationUrl || !pricingModel ||
      !Number.isSafeInteger(budgetMinor) || budgetMinor < 0 || !/^[A-Z]{3}$/.test(currencyCode) ||
      (startsAt !== null && (!Number.isSafeInteger(startsAt) || startsAt < 0)) ||
      (endsAt !== null && (!Number.isSafeInteger(endsAt) || endsAt < 0)) ||
      (startsAt !== null && endsAt !== null && endsAt <= startsAt)) {
    return adJson({ error: "INVALID_CAMPAIGN", message: "اطلاعات کمپین معتبر نیست؛ مقصد باید HTTPS باشد." }, 400);
  }
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  try {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO ad_campaigns (id, advertiser_user_id, title, creative_payload, destination_url, pricing_model, budget_minor, currency_code, reward_rate_bps, status, starts_at, ends_at, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 500, 'pending_review', ?, ?, ?, ?)"
      ).bind(id, auth.user.id, title, JSON.stringify({ description }), destinationUrl, pricingModel, budgetMinor, currencyCode, startsAt, endsAt, now, now),
      env.DB.prepare("INSERT INTO audit_events (id, actor_user_id, event_type, target_type, target_id, metadata_json, created_at) VALUES (?, ?, 'ad_campaign_submitted', 'ad_campaign', ?, ?, ?)")
        .bind(crypto.randomUUID(), auth.user.id, id, JSON.stringify({ pricingModel, budgetMinor, currencyCode }), now)
    ]);
    return adJson({ accepted: true, campaign: { id, title, status: "pending_review" }, message: "کمپین برای بررسی ارسال شد و تا تأیید مدیر نمایش داده نمی‌شود." }, 201);
  } catch { return adJson({ error: "CAMPAIGN_CREATE_FAILED" }, 503); }
}
