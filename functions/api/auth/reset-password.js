import { createPasswordRecord, originAllowed } from "../_lib/auth.js";
import { hashAuthToken } from "../_lib/auth-email.js";
import { authJson, readAuthBody, enforceAuthRateLimit } from "../_lib/auth-flow.js";
export async function onRequestPost({ request, env }) {
  if (env.AUTH_ENABLED !== "true" || !env.DB) return authJson({ error: "AUTH_NOT_CONFIGURED" }, 503);
  if (!originAllowed(request)) return authJson({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const parsed = await readAuthBody(request);
  if (parsed.error) return authJson({ error: parsed.error }, parsed.status);
  const token = typeof parsed.body.token === "string" ? parsed.body.token : "";
  const password = typeof parsed.body.password === "string" ? parsed.body.password : "";
  if (token.length < 30 || token.length > 128) return authJson({ error: "INVALID_OR_EXPIRED_TOKEN" }, 400);
  if (password.length < 12 || password.length > 128) return authJson({ error: "WEAK_PASSWORD", message: "رمز عبور باید حداقل ۱۲ و حداکثر ۱۲۸ نویسه باشد." }, 400);
  const limited = await enforceAuthRateLimit({ env, request, action: "reset-confirm", limit: 5 });
  if (limited) return limited;
  const now = Math.floor(Date.now() / 1000);
  const tokenHash = await hashAuthToken(token);
  const consumed = await env.DB.prepare("UPDATE password_reset_tokens SET consumed_at = ? WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ? RETURNING user_id").bind(now, tokenHash, now).first();
  if (!consumed?.user_id) return authJson({ error: "INVALID_OR_EXPIRED_TOKEN", message: "پیوند بازیابی نامعتبر یا منقضی شده است." }, 400);
  const record = await createPasswordRecord(password);
  const updated = await env.DB.prepare("UPDATE users SET password_hash = ?, password_salt = ?, password_iterations = ?, updated_at = ? WHERE id = ? AND status = 'active' RETURNING id").bind(record.hash, record.salt, record.iterations, now, consumed.user_id).first();
  if (!updated) return authJson({ error: "PASSWORD_RESET_FAILED" }, 400);
  await env.DB.prepare("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL").bind(now, consumed.user_id).run();
  return authJson({ passwordReset: true, sessionsRevoked: true });
}
