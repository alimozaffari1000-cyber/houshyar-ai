import { getSessionUser, originAllowed } from "../../../_lib/auth.js";
import { authJson, readAuthBody, enforceAuthRateLimit } from "../../../_lib/auth-flow.js";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const uuid = () => crypto.randomUUID();

function dimensions(bytes, type) {
  if (type === "image/png" && bytes.length >= 24) {
    return { width: new DataView(bytes.buffer, bytes.byteOffset).getUint32(16), height: new DataView(bytes.buffer, bytes.byteOffset).getUint32(20) };
  }
  if (type === "image/jpeg") {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      const size = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker) && offset + 8 < bytes.length) {
        return { height: (bytes[offset+5] << 8) | bytes[offset+6], width: (bytes[offset+7] << 8) | bytes[offset+8] };
      }
      if (size < 2) break;
      offset += 2 + size;
    }
  }
  if (type === "image/webp" && bytes.length >= 30) {
    const ascii = (start, value) => String.fromCharCode(...bytes.slice(start, start + value.length)) === value;
    if (!ascii(0, "RIFF") || !ascii(8, "WEBP")) return null;
    if (ascii(12, "VP8X")) {
      return { width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16), height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16) };
    }
    if (ascii(12, "VP8 ") && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      return { width: ((bytes[26] | (bytes[27] << 8)) & 0x3fff), height: ((bytes[28] | (bytes[29] << 8)) & 0x3fff) };
    }
    if (ascii(12, "VP8L") && bytes[20] === 0x2f) {
      return { width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8), height: 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10) };
    }
  }
  return null;
}

function matchesSignature(bytes, type) {
  if (type === "image/png") return bytes.length >= 24 && [137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value);
  if (type === "image/jpeg") return bytes.length >= 4 && bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff;
  if (type === "image/webp") return bytes.length >= 30 && String.fromCharCode(...bytes.slice(0,4))==="RIFF" && String.fromCharCode(...bytes.slice(8,12))==="WEBP";
  return false;
}

async function sellerContext(env, request, action) {
  try {
    const user = await getSessionUser(env.DB, request);
    if (!user) return { response: authJson({ error: "AUTH_REQUIRED" }, 401) };
    const limited = await enforceAuthRateLimit({ env, request, action, email: user.email, limit: 10 });
    if (limited) return { response: limited };
    const store = await env.DB.prepare("SELECT id, status FROM merchant_stores WHERE user_id = ? LIMIT 1").bind(user.id).first();
    if (!store) return { response: authJson({ error: "STORE_NOT_FOUND" }, 404) };
    if (store.status !== "active") return { response: authJson({ error: "STORE_NOT_APPROVED" }, 403) };
    return { user, store };
  } catch {
    return { response: authJson({ error: "MEDIA_AUTH_UNAVAILABLE" }, 503) };
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return authJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  if (!env.MEDIA_BUCKET) return authJson({ error: "MEDIA_STORAGE_NOT_CONFIGURED" }, 503);
  if (!originAllowed(request)) return authJson({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const context = await sellerContext(env, request, "product-media-upload");
  if (context.response) return context.response;
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) return authJson({ error: "UNSUPPORTED_MEDIA_TYPE" }, 415);
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES + 64 * 1024) return authJson({ error: "IMAGE_TOO_LARGE" }, 413);
  let form;
  try { form = await request.formData(); } catch { return authJson({ error: "INVALID_UPLOAD" }, 400); }
  const productId = String(form.get("productId") || "").trim();
  const file = form.get("file");
  if (!/^[0-9a-f-]{36}$/i.test(productId) || !(file instanceof File)) return authJson({ error: "INVALID_UPLOAD" }, 400);
  if (file.size < 1 || file.size > MAX_IMAGE_BYTES || !ALLOWED_TYPES.has(file.type)) return authJson({ error: "INVALID_IMAGE" }, 400);
  try {
    const product = await env.DB.prepare("SELECT id FROM products WHERE id = ? AND store_id = ? LIMIT 1").bind(productId, context.store.id).first();
    if (!product) return authJson({ error: "PRODUCT_NOT_FOUND" }, 404);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!matchesSignature(bytes, file.type)) return authJson({ error: "INVALID_IMAGE_SIGNATURE" }, 400);
    const size = dimensions(bytes, file.type);
    if (!size || !Number.isInteger(size.width) || !Number.isInteger(size.height) || size.width < 1 || size.height < 1 || size.width > 12000 || size.height > 12000) return authJson({ error: "INVALID_IMAGE_DIMENSIONS" }, 400);
    const mediaId = uuid();
    const key = "products/" + productId + "/" + mediaId;
    await env.MEDIA_BUCKET.put(key, bytes, { httpMetadata: { contentType: file.type }, customMetadata: { productId, mediaId } });
    try {
      await env.DB.prepare("INSERT INTO product_media (id, product_id, object_key, content_type, media_role, alt_text, width, height, sort_order, created_at) VALUES (?, ?, ?, ?, 'product', ?, ?, ?, 0, ?)").bind(mediaId, productId, key, file.type, "", size.width, size.height, Math.floor(Date.now()/1000)).run();
    } catch {
      await env.MEDIA_BUCKET.delete(key);
      return authJson({ error: "MEDIA_METADATA_SAVE_FAILED" }, 503);
    }
    return authJson({ uploaded: true, media: { id: mediaId, productId, contentType: file.type, width: size.width, height: size.height } }, 201);
  } catch {
    return authJson({ error: "MEDIA_UPLOAD_UNAVAILABLE" }, 503);
  }
}

export async function onRequestDelete({ request, env }) {
  if (!env.DB) return authJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  if (!env.MEDIA_BUCKET) return authJson({ error: "MEDIA_STORAGE_NOT_CONFIGURED" }, 503);
  if (!originAllowed(request)) return authJson({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const context = await sellerContext(env, request, "product-media-delete");
  if (context.response) return context.response;
  const parsed = await readAuthBody(request);
  if (parsed.error) return authJson({ error: parsed.error }, parsed.status);
  const mediaId = typeof parsed.body.mediaId === "string" ? parsed.body.mediaId.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(mediaId)) return authJson({ error: "INVALID_MEDIA_ID" }, 400);
  try {
    const media = await env.DB.prepare("SELECT pm.id, pm.object_key FROM product_media pm JOIN products p ON p.id = pm.product_id WHERE pm.id = ? AND p.store_id = ? LIMIT 1").bind(mediaId, context.store.id).first();
    if (!media) return authJson({ error: "MEDIA_NOT_FOUND" }, 404);
    await env.DB.prepare("DELETE FROM product_media WHERE id = ?").bind(mediaId).run();
    await env.MEDIA_BUCKET.delete(media.object_key);
    return authJson({ deleted: true, mediaId });
  } catch {
    return authJson({ error: "MEDIA_DELETE_UNAVAILABLE" }, 503);
  }
}
