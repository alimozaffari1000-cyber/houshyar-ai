import { requireAdsUser, adJson, readAdsJson, checkAdsRateLimit } from "../_lib/ads.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireAdsUser({ request, env });
  if (auth.response) return auth.response;
  try {
    let row = await env.DB.prepare("SELECT code FROM ad_referral_codes WHERE user_id = ? LIMIT 1").bind(auth.user.id).first();
    if (!row) {
      const code = randomCode();
      await env.DB.prepare("INSERT OR IGNORE INTO ad_referral_codes (code, user_id, created_at) VALUES (?, ?, ?)")
        .bind(code, auth.user.id, Math.floor(Date.now() / 1000)).run();
      row = await env.DB.prepare("SELECT code FROM ad_referral_codes WHERE user_id = ? LIMIT 1").bind(auth.user.id).first();
    }
    const stats = await env.DB.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'qualified' THEN 1 ELSE 0 END) AS qualified FROM referral_attributions WHERE referrer_user_id = ?")
      .bind(auth.user.id).first();
    return adJson({ code: row.code, total: Number(stats?.total || 0), qualified: Number(stats?.qualified || 0) });
  } catch { return adJson({ error: "REFERRAL_UNAVAILABLE" }, 503); }
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAdsUser({ request, env, write: true });
  if (auth.response) return auth.response;
  let rate;
  try { rate = await checkAdsRateLimit({ db: env.DB, request, action: "referral", limit: 10 }); }
  catch { return adJson({ error: "RATE_LIMIT_UNAVAILABLE" }, 503); }
  if (!rate.allowed) return adJson({ error: "RATE_LIMITED" }, 429, { "Retry-After": String(rate.retryAfter) });
  const parsed = await readAdsJson(request, 2048);
  if (parsed.error) return adJson({ error: parsed.error }, 400);
  const code = typeof parsed.body.code === "string" ? parsed.body.code.trim().toUpperCase() : "";
  if (!/^[A-Z0-9]{10,20}$/.test(code)) return adJson({ error: "INVALID_REFERRAL_CODE" }, 400);
  try {
    const referrer = await env.DB.prepare("SELECT user_id FROM ad_referral_codes WHERE code = ? LIMIT 1").bind(code).first();
    if (!referrer || referrer.user_id === auth.user.id) return adJson({ error: "REFERRAL_NOT_VALID" }, 400);
    const result = await env.DB.prepare("INSERT OR IGNORE INTO referral_attributions (id, referrer_user_id, referred_user_id, referral_code, attributed_at, status) VALUES (?, ?, ?, ?, ?, 'attributed')")
      .bind(crypto.randomUUID(), referrer.user_id, auth.user.id, code, Math.floor(Date.now() / 1000)).run();
    if (!result.meta?.changes) return adJson({ accepted: true, duplicate: true });
    return adJson({ accepted: true, qualified: false, message: "دعوت ثبت شد؛ پاداش فقط پس از احراز شرایط معتبر می‌شود." }, 201);
  } catch { return adJson({ error: "REFERRAL_SAVE_FAILED" }, 503); }
}

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join("");
}
