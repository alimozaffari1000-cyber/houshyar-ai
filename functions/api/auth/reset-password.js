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
  const record = await createPasswordRecord(password);

  // D1 batch is transactional: update the account, consume the matching token,
  // and revoke sessions together. Never burn a valid token in a separate query
  // before knowing that the corresponding account update can succeed.
  const results = await env.DB.batch([
    env.DB.prepare(
      "UPDATE users SET password_hash = ?, password_salt = ?, password_iterations = ?, updated_at = ? " +
      "WHERE id = (SELECT user_id FROM password_reset_tokens WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ?) " +
      "AND status = 'active'"
    ).bind(record.hash, record.salt, record.iterations, now, tokenHash, now),
    env.DB.prepare(
      "UPDATE password_reset_tokens SET consumed_at = ? " +
      "WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ? " +
      "AND EXISTS (SELECT 1 FROM users WHERE users.id = password_reset_tokens.user_id AND users.status = 'active')"
    ).bind(now, tokenHash, now),
    env.DB.prepare(
      "UPDATE sessions SET revoked_at = ? WHERE user_id = " +
      "(SELECT user_id FROM password_reset_tokens WHERE token_hash = ? AND consumed_at = ?) AND revoked_at IS NULL"
    ).bind(now, tokenHash, now)
  ]);

  if (results?.[0]?.meta?.changes !== 1 || results?.[1]?.meta?.changes !== 1) {
    return authJson({ error: "INVALID_OR_EXPIRED_TOKEN", message: "پیوند بازیابی نامعتبر یا منقضی شده است." }, 400);
  }
  if (!results?.[2]?.meta) return authJson({ error: "PASSWORD_RESET_FAILED" }, 500);
  return authJson({ passwordReset: true, sessionsRevoked: true });
}
