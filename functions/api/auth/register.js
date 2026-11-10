import { createPasswordRecord, createSession, normalizeEmail, validEmail, sessionCookie, originAllowed } from "../_lib/auth.js";
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers } });
export async function onRequestPost({ request, env }) {
  if (env.AUTH_ENABLED !== "true") return json({ error: "AUTH_NOT_CONFIGURED" }, 503);
  if (!env.DB) return json({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  if (!originAllowed(request)) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) return json({ error: "UNSUPPORTED_MEDIA_TYPE" }, 415);
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > 8192) return json({ error: "BODY_TOO_LARGE" }, 413);
  let raw;
  try { raw = await request.text(); } catch { return json({ error: "INVALID_JSON" }, 400); }
  if (new TextEncoder().encode(raw).byteLength > 8192) return json({ error: "BODY_TOO_LARGE" }, 413);
  let body; try { body = JSON.parse(raw); } catch { return json({ error: "INVALID_JSON" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "INVALID_BODY" }, 400);
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!validEmail(email)) return json({ error: "INVALID_EMAIL", message: "ایمیل معتبر وارد کنید." }, 400);
  if (password.length < 12 || password.length > 128) return json({ error: "WEAK_PASSWORD", message: "رمز عبور باید حداقل ۱۲ و حداکثر ۱۲۸ نویسه باشد." }, 400);
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();
  const record = await createPasswordRecord(password);
  try {
    await env.DB.prepare("INSERT INTO users (id, email_normalized, password_hash, password_salt, password_iterations, status, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', 'user', ?, ?)").bind(id, email, record.hash, record.salt, record.iterations, now, now).run();
  } catch { return json({ error: "REGISTRATION_UNAVAILABLE", message: "ثبت‌نام انجام نشد؛ ممکن است این ایمیل قبلاً ثبت شده باشد." }, 409); }
  const session = await createSession(env.DB, id, now);
  return json({ user: { id, email, role: "user" } }, 201, { "Set-Cookie": sessionCookie(session.token) });
}