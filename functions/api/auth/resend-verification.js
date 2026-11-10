import { normalizeEmail, validEmail, originAllowed } from "../_lib/auth.js";
import { authEmailLink, sendAuthEmail, createAuthToken, hashAuthToken } from "../_lib/auth-email.js";
import { authJson, readAuthBody, enforceAuthRateLimit } from "../_lib/auth-flow.js";
export async function onRequestPost({ request, env }) {
  if (env.AUTH_ENABLED !== "true" || !env.DB) return authJson({ error: "AUTH_NOT_CONFIGURED" }, 503);
  if (!originAllowed(request)) return authJson({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const parsed = await readAuthBody(request);
  if (parsed.error) return authJson({ error: parsed.error }, parsed.status);
  const email = normalizeEmail(parsed.body.email);
  if (!validEmail(email)) return authJson({ error: "INVALID_EMAIL" }, 400);
  const limited = await enforceAuthRateLimit({ env, request, action: "resend", email, limit: 3 });
  if (limited) return limited;
  const user = await env.DB.prepare("SELECT id FROM users WHERE email_normalized = ? AND status = 'pending' LIMIT 1").bind(email).first();
  if (user) {
    const now = Math.floor(Date.now() / 1000);
    const token = createAuthToken();
    await env.DB.prepare("UPDATE email_verification_tokens SET consumed_at = ? WHERE user_id = ? AND consumed_at IS NULL").bind(now, user.id).run();
    await env.DB.prepare("INSERT INTO email_verification_tokens (id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), user.id, await hashAuthToken(token), now, now + 86400).run();
    try {
      const link = authEmailLink(env, "verify_email", token);
      await sendAuthEmail(env, { to: email, subject: "پیوند جدید تأیید ایمیل هوش‌یار", text: "برای تأیید ایمیل خود این پیوند را باز کنید:\n" + link + "\nاعتبار: ۲۴ ساعت." });
    } catch { return authJson({ error: "AUTH_EMAIL_DELIVERY_FAILED" }, 503); }
  }
  return authJson({ accepted: true, message: "اگر حساب تأییدنشده‌ای با این ایمیل وجود داشته باشد، پیوند ارسال می‌شود." }, 202);
}
