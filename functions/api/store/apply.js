import { getSessionUser, originAllowed } from "../_lib/auth.js";
import { authJson, readAuthBody } from "../_lib/auth-flow.js";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export async function onRequestPost({ request, env }) {
  if (!env.DB) return authJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  if (!originAllowed(request)) return authJson({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const user = await getSessionUser(env.DB, request);
  if (!user) return authJson({ error: "AUTH_REQUIRED" }, 401);
  const parsed = await readAuthBody(request);
  if (parsed.error) return authJson({ error: parsed.error }, parsed.status);
  const name = typeof parsed.body.name === "string" ? parsed.body.name.trim() : "";
  const slug = typeof parsed.body.slug === "string" ? parsed.body.slug.trim().toLowerCase() : "";
  const description = typeof parsed.body.description === "string" ? parsed.body.description.trim() : "";
  if (name.length < 2 || name.length > 100) return authJson({ error: "INVALID_STORE_NAME" }, 400);
  if (!slugPattern.test(slug) || slug.length > 80) return authJson({ error: "INVALID_STORE_SLUG" }, 400);
  if (description.length > 1000) return authJson({ error: "DESCRIPTION_TOO_LONG" }, 400);
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(
      "INSERT INTO merchant_stores (id, user_id, name, slug, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)"
    ).bind(id, user.id, name, slug, description, now, now).run();
    return authJson({ accepted: true, store: { id, name, slug, status: "pending" } }, 201);
  } catch {
    return authJson({ error: "STORE_APPLICATION_CONFLICT", message: "برای این حساب فروشگاه ثبت شده یا نامک قبلاً استفاده شده است." }, 409);
  }
}
