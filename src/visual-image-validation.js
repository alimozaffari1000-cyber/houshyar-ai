export const MAX_VISUAL_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_VISUAL_IMAGE_PIXELS = 40_000_000;
export const VISUAL_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function validateVisualImage(file, decode = globalThis.createImageBitmap) {
  if (!file || !VISUAL_IMAGE_TYPES.has(file.type) || !Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_VISUAL_IMAGE_BYTES) {
    return { valid: false, reason: "unsupported" };
  }
  if (typeof decode !== "function") return { valid: false, reason: "decoder_unavailable" };
  let bitmap;
  try {
    bitmap = await decode(file);
    const width = Number(bitmap?.width);
    const height = Number(bitmap?.height);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > MAX_VISUAL_IMAGE_PIXELS) {
      return { valid: false, reason: "dimensions" };
    }
    return { valid: true, width, height };
  } catch {
    return { valid: false, reason: "decode_failed" };
  } finally {
    bitmap?.close?.();
  }
}
