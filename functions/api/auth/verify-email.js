import { originAllowed } from "../_lib/auth.js";
import { hashAuthToken } from "../_lib/auth-email.js";
import { authJson, readAuthBody, enforceAuthRateLimit } from "../_lib/auth-flow.js";
export async function onRequestPost({ request, env }) {
  if (env.AUTH_ENABLED !== "true" || !env.DB) return authJson({ error: "AUTH_NOT_CONFIGURED" }, 503);
  if (!originAllowed(request)) return authJson({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const parsed = await readAuthBody(request);
  if (parsed.error) return authJson({ error: parsed.error }, parsed.status);
  const token = typeof parsed.body.token === "string" ? parsed.body.token : "";
  if (token.length < 30 || token.length > 128) return authJson({ error: "INVALID_OR_EXPIRED_TOKEN" }, 400);
  const limited = await enforceAuthRateLimit({ env, request, action: "verify", limit: 10 });
  if (limited) return limited;
  const now = Math.floor(Date.now() / 1000);
  const tokenHash = await hashAuthToken(token);
  const user = await env.DB.prepare("UPDATE users SET status = 'active', updated_at = ? WHERE id = (SELECT user_id FROM email_verification_tokens WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ?) AND status = 'pending' RETURNING id").bind(now, tokenHash, now).first();
  if (!user) return authJson({ error: "INVALID_OR_EXPIRED_TOKEN", message: "پیوند تأیید نامعتبر یا منقضی شده است." }, 400);
  await env.DB.prepare("UPDATE email_verification_tokens SET consumed_at = ? WHERE token_hash = ? AND consumed_at IS NULL").bind(now, tokenHash).run();
  return authJson({ verified: true });
}
