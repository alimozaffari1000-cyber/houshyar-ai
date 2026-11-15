import { getSessionUser } from "../_lib/auth.js";
import { authJson } from "../_lib/auth-flow.js";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function onRequestGet({ request, env, params }) {
  if (!env.DB || !env.MEDIA_BUCKET) return authJson({ error: "MEDIA_STORAGE_UNAVAILABLE" }, 503);
  const mediaId = typeof params?.id === "string" ? params.id.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(mediaId)) return authJson({ error: "MEDIA_NOT_FOUND" }, 404);

  try {
    const media = await env.DB.prepare(
      "SELECT pm.object_key AS objectKey, pm.content_type AS contentType, pm.width, pm.height, " +
      "p.status AS productStatus, s.status AS storeStatus, s.user_id AS storeOwner " +
      "FROM product_media pm JOIN products p ON p.id = pm.product_id " +
      "JOIN merchant_stores s ON s.id = p.store_id WHERE pm.id = ? LIMIT 1"
    ).bind(mediaId).first();

    if (!media || !ALLOWED_TYPES.has(media.contentType)) return authJson({ error: "MEDIA_NOT_FOUND" }, 404);

    const isPublic = media.productStatus === "published" && media.storeStatus === "active";
    if (!isPublic) {
      const user = await getSessionUser(env.DB, request);
      if (!user || user.id !== media.storeOwner) return authJson({ error: "MEDIA_NOT_FOUND" }, 404);
    }

    const object = await env.MEDIA_BUCKET.get(media.objectKey);
    if (!object) return authJson({ error: "MEDIA_NOT_FOUND" }, 404);

    const headers = new Headers({
      "Content-Type": media.contentType,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": isPublic ? "public, max-age=300, s-maxage=3600" : "private, no-store",
      "Content-Length": String(object.size || 0)
    });
    if (object.httpEtag) headers.set("ETag", object.httpEtag);
    return new Response(object.body, { status: 200, headers });
  } catch {
    return authJson({ error: "MEDIA_READ_UNAVAILABLE" }, 503);
  }
}
