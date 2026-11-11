const WINDOW_SECONDS = 900;
const ACTION_LIMITS = { register: 5, login: 10, verify: 10, resend: 3, "password-reset": 3, "reset-confirm": 5 };
async function hash(value) {
  const bytes = new TextEncoder().encode(value);
  const result = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(result), b => b.toString(16).padStart(2, "0")).join("");
}
export async function checkAuthRateLimit({ db, action, email, clientIp, now = Math.floor(Date.now() / 1000), limit }) {
  if (!db || typeof db.prepare !== "function") throw new Error("AUTH_RATE_LIMIT_STORAGE_UNAVAILABLE");
  const safeAction = Object.hasOwn(ACTION_LIMITS, action) ? action : "login";
  const configured = Number.isInteger(limit) ? limit : ACTION_LIMITS[safeAction];
  const safeLimit = Math.max(1, Math.min(30, configured));
  const windowStart = Math.floor(now / WINDOW_SECONDS) * WINDOW_SECONDS;
  const ipHash = await hash(String(clientIp || "unknown"));
  const emailHash = await hash(String(email || "").trim().toLowerCase());
  const expiresAt = windowStart + WINDOW_SECONDS * 2;
  const keys = [
    "auth:" + safeAction + ":ip:" + ipHash,
    "auth:" + safeAction + ":email:" + emailHash
  ];
  const results = await Promise.all(keys.map(key => db.prepare(
    "INSERT INTO api_rate_limits (bucket_key, window_start, request_count, expires_at) VALUES (?, ?, 1, ?) " +
    "ON CONFLICT(bucket_key, window_start) DO UPDATE SET request_count = request_count + 1, expires_at = excluded.expires_at RETURNING request_count"
  ).bind(key, windowStart, expiresAt).first()));
  if (results.some(row => !row || !Number.isInteger(row.request_count))) throw new Error("AUTH_RATE_LIMIT_INVALID_RESPONSE");
  const count = Math.max(...results.map(row => row.request_count));
  return { allowed: count <= safeLimit, retryAfter: Math.max(1, windowStart + WINDOW_SECONDS - now), limit: safeLimit };
}
