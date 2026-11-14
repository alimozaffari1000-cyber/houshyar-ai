import { getSessionUser, originAllowed } from "./auth.js";
export const MARKET_COUNTRIES = new Set(["IR", "AE", "DE", "TR"]);
export const MARKET_CURRENCIES = { IR: "IRR", AE: "AED", DE: "EUR", TR: "TRY" };
export const MARKET_CATEGORIES = new Set(["goods", "property", "vehicles", "jobs", "services", "fashion"]);
export const marketJson = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
export function validCountry(value) { return typeof value === "string" && MARKET_COUNTRIES.has(value.toUpperCase()); }
export function cleanText(value, min, max) { if (typeof value !== "string") return null; const result = value.trim(); return result.length >= min && result.length <= max ? result : null; }
export async function readMarketBody(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 12000) return { error: "BODY_TOO_LARGE", status: 413 };
  try { const body = await request.json(); if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "INVALID_BODY", status: 400 }; return { body }; }
  catch { return { error: "INVALID_JSON", status: 400 }; }
}
export async function requireMarketUser(request, env) {
  if (!env.DB) return { response: marketJson({ error: "DATABASE_NOT_CONFIGURED" }, 503) };
  const user = await getSessionUser(env.DB, request);
  if (!user) return { response: marketJson({ error: "AUTH_REQUIRED" }, 401) };
  return { user };
}
export async function enforceMarketWriteLimit(db, userId, action, now = Math.floor(Date.now() / 1000)) {
  const windowStart = Math.floor(now / 3600) * 3600, key = "market:" + action + ":" + userId;
  await db.prepare("INSERT INTO api_rate_limits (bucket_key, window_start, request_count, expires_at) VALUES (?, ?, 1, ?) ON CONFLICT(bucket_key, window_start) DO UPDATE SET request_count = request_count + 1").bind(key, windowStart, windowStart + 7200).run();
  const row = await db.prepare("SELECT request_count FROM api_rate_limits WHERE bucket_key = ? AND window_start = ?").bind(key, windowStart).first();
  const limits = { store: 3, listing: 20, "image-upload": 15 };\n  return Number(row?.request_count || 0) > (limits[action] || 10);
}
export function validSlug(value) { return typeof value === "string" && /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(value); }
