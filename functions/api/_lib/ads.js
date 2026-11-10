import { getSessionUser, originAllowed } from "./auth.js";

export const adJson = (body, status = 200, extraHeaders = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    ...extraHeaders
  }
});

export async function requireAdsUser({ request, env, write = false }) {
  if (env.ADS_MARKETPLACE_ENABLED !== "true") return { response: adJson({ error: "ADS_NOT_CONFIGURED", message: "بازار تبلیغات هنوز فعال نشده است." }, 503) };
  if (env.AUTH_ENABLED !== "true" || !env.DB) return { response: adJson({ error: "ADS_AUTH_NOT_CONFIGURED" }, 503) };
  if (write && !originAllowed(request)) return { response: adJson({ error: "ORIGIN_NOT_ALLOWED" }, 403) };
  let user;
  try { user = await getSessionUser(env.DB, request); }
  catch { return { response: adJson({ error: "AUTH_UNAVAILABLE" }, 503) }; }
  if (!user) return { response: adJson({ error: "AUTH_REQUIRED" }, 401) };
  return { user };
}

export async function readAdsJson(request, maxBytes = 12 * 1024) {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return { error: "BODY_TOO_LARGE" };
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > maxBytes) return { error: "BODY_TOO_LARGE" };
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "INVALID_BODY" };
    return { body };
  } catch { return { error: "INVALID_JSON" }; }
}

export async function checkAdsRateLimit({ db, request, action, limit = 20, now = Math.floor(Date.now() / 1000) }) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  const windowSeconds = 60;
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const key = "ads:" + action + ":" + hash;
  const row = await db.prepare(
    "INSERT INTO api_rate_limits (bucket_key, window_start, request_count, expires_at) VALUES (?, ?, 1, ?) " +
    "ON CONFLICT(bucket_key, window_start) DO UPDATE SET request_count = request_count + 1, expires_at = excluded.expires_at RETURNING request_count"
  ).bind(key, windowStart, windowStart + 120).first();
  if (!row || !Number.isInteger(row.request_count)) throw new Error("ADS_RATE_LIMIT_UNAVAILABLE");
  return { allowed: row.request_count <= Math.max(1, Math.min(60, limit)), retryAfter: Math.max(1, windowStart + windowSeconds - now) };
}

export function safeHttpsUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.hostname.length < 3) return null;
    return url.toString();
  } catch { return null; }
}

export function validText(value, max, min = 1) {
  return typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
}
