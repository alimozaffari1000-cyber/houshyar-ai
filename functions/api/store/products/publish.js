import { getSessionUser, originAllowed } from "../../_lib/auth.js";
import { authJson, readAuthBody, enforceAuthRateLimit } from "../../_lib/auth-flow.js";

export async function onRequestPost({ request, env }) {
  if (!env.DB) return authJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  if (!originAllowed(request)) return authJson({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const user = await getSessionUser(env.DB, request);
  if (!user) return authJson({ error: "AUTH_REQUIRED" }, 401);
  const limited = await enforceAuthRateLimit({ env, request, action: "product-publish", email: user.email, limit: 30 });
  if (limited) return limited;
  const parsed = await readAuthBody(request);
  if (parsed.error) return authJson({ error: parsed.error }, parsed.status);
  const productId = typeof parsed.body.productId === "string" ? parsed.body.productId.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return authJson({ error: "INVALID_PRODUCT_ID" }, 400);
  try {
    const store = await env.DB.prepare("SELECT id, status FROM merchant_stores WHERE user_id = ? LIMIT 1").bind(user.id).first();
    if (!store) return authJson({ error: "STORE_NOT_FOUND" }, 404);
    if (store.status !== "active") return authJson({ error: "STORE_NOT_APPROVED" }, 403);
    const result = await env.DB.prepare(
      "UPDATE products SET status = 'published', updated_at = ? WHERE id = ? AND store_id = ? AND status = 'draft'"
    ).bind(Math.floor(Date.now() / 1000), productId, store.id).run();
    if (!result.meta?.changes) return authJson({ error: "DRAFT_PRODUCT_NOT_FOUND" }, 404);
    return authJson({ published: true, productId });
  } catch {
    return authJson({ error: "PRODUCT_PUBLISH_UNAVAILABLE" }, 503);
  }
}
