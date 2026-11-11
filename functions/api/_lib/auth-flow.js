import { checkAuthRateLimit } from "./auth-rate-limit.js";
export const authJson = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers }
});
export function isJsonContentType(value) {
  if (typeof value !== "string") return false;
  return value.split(";", 1)[0].trim().toLowerCase() === "application/json";
}
export async function readAuthBody(request) {
  if (!isJsonContentType(request.headers.get("content-type"))) return { error: "UNSUPPORTED_MEDIA_TYPE", status: 415 };
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > 8192) return { error: "BODY_TOO_LARGE", status: 413 };
  let raw;
  try { raw = await request.text(); } catch { return { error: "INVALID_JSON", status: 400 }; }
  if (new TextEncoder().encode(raw).byteLength > 8192) return { error: "BODY_TOO_LARGE", status: 413 };
  let body;
  try { body = JSON.parse(raw); } catch { return { error: "INVALID_JSON", status: 400 }; }
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "INVALID_BODY", status: 400 };
  return { body };
}
export async function enforceAuthRateLimit({ env, request, action, email = "", limit }) {
  try {
    const result = await checkAuthRateLimit({
      db: env.DB,
      action,
      email,
      clientIp: request.headers.get("cf-connecting-ip") || "unknown",
      limit
    });
    if (!result.allowed) return authJson({ error: "AUTH_RATE_LIMITED", message: "تعداد تلاش‌ها بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید." }, 429, { "Retry-After": String(result.retryAfter) });
    return null;
  } catch {
    return authJson({ error: "AUTH_RATE_LIMIT_UNAVAILABLE", message: "کنترل امنیتی موقتاً در دسترس نیست." }, 503);
  }
}
