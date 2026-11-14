import { originAllowed } from "../../_lib/auth.js";
import { marketJson, validCountry, requireMarketUser, enforceMarketWriteLimit } from "../../_lib/marketplace.js";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = {
  "image/jpeg": { extension: "jpg", signature: bytes => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/png": { extension: "png", signature: bytes => bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a },
  "image/webp": { extension: "webp", signature: bytes => bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP" }
};

export async function onRequestPost({ request, env }) {
  if (!originAllowed(request)) return marketJson({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (!env.R2_BUCKET) return marketJson({ error: "IMAGE_STORAGE_NOT_CONFIGURED" }, 503);
  const auth = await requireMarketUser(request, env);
  if (auth.response) return auth.response;

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_IMAGE_BYTES + 64 * 1024) return marketJson({ error: "IMAGE_TOO_LARGE" }, 413);

  let form;
  try { form = await request.formData(); }
  catch { return marketJson({ error: "INVALID_MULTIPART_BODY" }, 400); }

  const file = form.get("image");
  const storeId = form.get("storeId");
  const country = typeof form.get("country") === "string" ? form.get("country").toUpperCase() : "";
  if (!validCountry(country) || typeof storeId !== "string" || !storeId || storeId.length > 64) {
    return marketJson({ error: "INVALID_IMAGE_TARGET" }, 400);
  }
  if (!file || typeof file.arrayBuffer !== "function" || typeof file.size !== "number") {
    return marketJson({ error: "IMAGE_REQUIRED" }, 400);
  }
  if (file.size < 1 || file.size > MAX_IMAGE_BYTES) return marketJson({ error: "IMAGE_TOO_LARGE_OR_EMPTY" }, 413);

  const mime = file.type?.toLowerCase() || "";
  const type = IMAGE_TYPES[mime];
  if (!type) return marketJson({ error: "UNSUPPORTED_IMAGE_TYPE" }, 415);

  try {
    const store = await env.DB.prepare(
      "SELECT id FROM marketplace_stores WHERE id = ? AND owner_user_id = ? AND country_code = ? AND status IN ('pending','active') LIMIT 1"
    ).bind(storeId, auth.user.id, country).first();
    if (!store) return marketJson({ error: "STORE_NOT_FOUND_OR_NOT_OWNED" }, 404);

    if (await enforceMarketWriteLimit(env.DB, auth.user.id, "image-upload")) {
      return marketJson({ error: "RATE_LIMITED" }, 429);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength !== file.size || !type.signature(bytes)) {
      return marketJson({ error: "IMAGE_CONTENT_MISMATCH" }, 415);
    }

    const objectKey = "marketplace/" + country.toLowerCase() + "/" + storeId + "/" + crypto.randomUUID() + "." + type.extension;
    await env.R2_BUCKET.put(objectKey, bytes, {
      httpMetadata: { contentType: mime, cacheControl: "private, max-age=0, no-store" },
      customMetadata: { ownerUserId: auth.user.id, storeId, country, purpose: "marketplace-image" }
    });
    return marketJson({ uploaded: true, objectKey, contentType: mime, size: bytes.byteLength }, 201);
  } catch {
    return marketJson({ error: "IMAGE_UPLOAD_FAILED" }, 503);
  }
}
