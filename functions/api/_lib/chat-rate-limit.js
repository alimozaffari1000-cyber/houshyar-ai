const WINDOW_SECONDS = 60;

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Atomic D1-backed fixed-window limiter. The caller must pass a trusted
 * Cloudflare-provided client IP, never an arbitrary x-forwarded-for value.
 */
export async function checkChatRateLimit({ db, clientIp, now = Math.floor(Date.now() / 1000), limit = 20 }) {
  if (!db || typeof db.prepare !== "function") {
    throw new Error("RATE_LIMIT_DATABASE_UNAVAILABLE");
  }

  const safeLimit = Number.isInteger(limit) ? Math.min(120, Math.max(1, limit)) : 20;
  const windowStart = Math.floor(now / WINDOW_SECONDS) * WINDOW_SECONDS;
  const bucketKey = `chat:ip:${await sha256Hex(String(clientIp || "unknown"))}`;
  const expiresAt = windowStart + WINDOW_SECONDS * 2;

  const row = await db.prepare(
    `INSERT INTO api_rate_limits (bucket_key, window_start, request_count, expires_at)
     VALUES (?, ?, 1, ?)
     ON CONFLICT(bucket_key, window_start)
     DO UPDATE SET request_count = request_count + 1, expires_at = excluded.expires_at
     RETURNING request_count`
  ).bind(bucketKey, windowStart, expiresAt).first();

  if (!row || !Number.isInteger(row.request_count)) {
    throw new Error("RATE_LIMIT_DATABASE_INVALID_RESPONSE");
  }

  return {
    allowed: row.request_count <= safeLimit,
    count: row.request_count,
    limit: safeLimit,
    retryAfter: Math.max(1, windowStart + WINDOW_SECONDS - now)
  };
}
