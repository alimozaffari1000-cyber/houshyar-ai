import { authJson } from "../../_lib/auth-flow.js";

export async function onRequestGet({ env, params }) {
  if (!env.DB) return authJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  const productId = typeof params?.id === "string" ? params.id.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return authJson({ error: "PRODUCT_NOT_FOUND" }, 404);
  try {
    const product = await env.DB.prepare(
      "SELECT p.id FROM products p JOIN merchant_stores s ON s.id = p.store_id " +
      "WHERE p.id = ? AND p.status = 'published' AND s.status = 'active' LIMIT 1"
    ).bind(productId).first();
    if (!product) return authJson({ error: "PRODUCT_NOT_FOUND" }, 404);
    const result = await env.DB.prepare(
      "SELECT pm.id, pm.content_type AS contentType, pm.width, pm.height, pm.media_role AS role, pm.sort_order AS sortOrder " +
      "FROM product_media pm WHERE pm.product_id = ? ORDER BY pm.sort_order ASC, pm.created_at ASC LIMIT 100"
    ).bind(productId).all();
    return authJson({ media: Array.isArray(result.results) ? result.results : [] }, 200, { "Cache-Control": "public, max-age=60, s-maxage=60" });
  } catch {
    return authJson({ error: "PRODUCT_MEDIA_UNAVAILABLE" }, 503);
  }
}
