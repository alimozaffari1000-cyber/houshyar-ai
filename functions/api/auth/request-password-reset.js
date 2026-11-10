import { normalizeEmail, validEmail, originAllowed } from "../_lib/auth.js";
import { authEmailLink, authEmailConfig, sendAuthEmail, createAuthToken, hashAuthToken } from "../_lib/auth-email.js";
import { authJson, readAuthBody, enforceAuthRateLimit } from "../_lib/auth-flow.js";
export async function onRequestPost({ request, env }) {
  if (env.AUTH_ENABLED !== "true" || !env.DB) return authJson({ error: "AUTH_NOT_CONFIGURED" }, 503);
  if (!originAllowed(request)) return authJson({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (!authEmailConfig(env)) return authJson({ error: "AUTH_EMAIL_NOT_CONFIGURED" }, 503);
  const parsed = await readAuthBody(request);
  if (parsed.error) return authJson({ error: parsed.error }, parsed.status);
  const email = normalizeEmail(parsed.body.email);
  if (!validEmail(email)) return authJson({ error: "INVALID_EMAIL" }, 400);
  const limited = await enforceAuthRateLimit({ env, request, action: "password-reset", email, limit: 3 });
  if (limited) return limited;
  const user = await env.DB.prepare("SELECT id FROM users WHERE email_normalized = ? AND status = 'active' LIMIT 1").bind(email).first();
  if (user) {
    const now = Math.floor(Date.now() / 1000);
    const token = createAuthToken();
    await env.DB.prepare("UPDATE password_reset_tokens SET consumed_at = ? WHERE user_id = ? AND consumed_at IS NULL").bind(now, user.id).run();
    await env.DB.prepare("INSERT INTO password_reset_tokens (id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), user.id, await hashAuthToken(token), now, now + 1800).run();
    try {
      const link = authEmailLink(env, "reset_password", token);
      await sendAuthEmail(env, { to: email, subject: "بازیابی رمز عبور هوش‌یار", text: "برای تعیین رمز عبور جدید این پیوند را در سایت باز کنید:\n" + link + "\nاین پیوند تا ۳۰ دقیقه معتبر است. اگر شما این درخواست را نداده‌اید، پیام را نادیده بگیرید." });
    } catch { /* Keep the public response identical for existing and unknown addresses. */ }
  }
  return authJson({ accepted: true, message: "اگر حساب فعالی با این ایمیل وجود داشته باشد، دستور بازیابی ارسال می‌شود." }, 202);
}
