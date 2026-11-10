import { createSession, normalizeEmail, validEmail, verifyPassword, sessionCookie, originAllowed } from "../_lib/auth.js";
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
  if (!validEmail(email) || password.length > 128) return json({ error: "INVALID_CREDENTIALS", message: "ایمیل یا رمز عبور نادرست است." }, 401);
  const user = await env.DB.prepare("SELECT id, email_normalized, password_hash, password_salt, password_iterations, role FROM users WHERE email_normalized = ? AND status = 'active' LIMIT 1").bind(email).first();
  const valid = user ? await verifyPassword(password, user.password_salt, user.password_hash, user.password_iterations) : false;
  if (!valid) return json({ error: "INVALID_CREDENTIALS", message: "ایمیل یا رمز عبور نادرست است." }, 401);
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?").bind(now, now, user.id).run();
  const session = await createSession(env.DB, user.id, now);
  return json({ user: { id: user.id, email: user.email_normalized, role: user.role } }, 200, { "Set-Cookie": sessionCookie(session.token) });
}