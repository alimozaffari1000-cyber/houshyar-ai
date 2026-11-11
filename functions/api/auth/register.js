import { normalizeEmail, validEmail, createPasswordRecord, originAllowed } from "../_lib/auth.js";
import { authEmailLink, authEmailConfig, sendAuthEmail, createAuthToken, hashAuthToken } from "../_lib/auth-email.js";
import { authJson, readAuthBody, enforceAuthRateLimit } from "../_lib/auth-flow.js";
export async function onRequestPost({ request, env }) {
  if (env.AUTH_ENABLED !== "true") return authJson({ error: "AUTH_NOT_CONFIGURED" }, 503);
  if (!env.DB) return authJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  if (!originAllowed(request)) return authJson({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (!authEmailConfig(env)) return authJson({ error: "AUTH_EMAIL_NOT_CONFIGURED" }, 503);
  const parsed = await readAuthBody(request);
  if (parsed.error) return authJson({ error: parsed.error }, parsed.status);
  const email = normalizeEmail(parsed.body.email);
  const password = typeof parsed.body.password === "string" ? parsed.body.password : "";
  const limited = await enforceAuthRateLimit({ env, request, action: "register", email, limit: Number(env.AUTH_REGISTER_LIMIT) || 5 });
  if (limited) return limited;
  if (!validEmail(email)) return authJson({ error: "INVALID_EMAIL", message: "ایمیل معتبر وارد کنید." }, 400);
  if (password.length < 12 || password.length > 128) return authJson({ error: "WEAK_PASSWORD", message: "رمز عبور باید حداقل ۱۲ و حداکثر ۱۲۸ نویسه باشد." }, 400);
  let existing;
  try { existing = await env.DB.prepare("SELECT id FROM users WHERE email_normalized = ? LIMIT 1").bind(email).first(); }
  catch { return authJson({ error: "REGISTRATION_UNAVAILABLE" }, 503); }
  if (existing) return authJson({ accepted: true, verificationRequired: true }, 202);
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();
  const record = await createPasswordRecord(password);
  try {
    await env.DB.prepare("INSERT INTO users (id, email_normalized, password_hash, password_salt, password_iterations, status, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', 'user', ?, ?)").bind(id, email, record.hash, record.salt, record.iterations, now, now).run();
  } catch {
    return authJson({ error: "REGISTRATION_UNAVAILABLE" }, 503);
  }
  const token = createAuthToken();
  await env.DB.prepare("INSERT INTO email_verification_tokens (id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), id, await hashAuthToken(token), now, now + 86400).run();
  try {
    const link = authEmailLink(env, "verify_email", token);
    await sendAuthEmail(env, { to: email, subject: "تأیید ایمیل هوش‌یار", text: "برای فعال‌سازی حساب هوش‌یار، پیوند زیر را در سایت باز کنید و تأیید را بزنید:\n" + link + "\nاین پیوند تا ۲۴ ساعت معتبر است." });
  } catch {
    // Keep the response indistinguishable from duplicate-address handling.
  }
  return authJson({ accepted: true, verificationRequired: true }, 202);
}
