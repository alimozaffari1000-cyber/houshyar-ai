import test from "node:test";
import assert from "node:assert/strict";
import { validateVisualImage, MAX_VISUAL_IMAGE_PIXELS, MAX_VISUAL_IMAGE_BYTES } from "../src/visual-image-validation.js";

const file = (overrides = {}) => ({ type: "image/png", size: 1024, ...overrides });

test("accepts a supported image after successful decoding", async () => {
  let closed = false;
  const result = await validateVisualImage(file(), async () => ({ width: 1200, height: 800, close() { closed = true; } }));
  assert.deepEqual(result, { valid: true, width: 1200, height: 800 });
  assert.equal(closed, true);
});

test("rejects unsupported, empty and oversized files before decoding", async () => {
  let decoded = false;
  const decode = async () => { decoded = true; return { width: 1, height: 1 }; };
  assert.equal((await validateVisualImage(file({ type: "image/svg+xml" }), decode)).valid, false);
  assert.equal((await validateVisualImage(file({ size: 0 }), decode)).valid, false);
  assert.equal((await validateVisualImage(file({ size: MAX_VISUAL_IMAGE_BYTES + 1 }), decode)).valid, false);
  assert.equal(decoded, false);
});

test("rejects excessive decoded pixel dimensions and closes bitmap", async () => {
  let closed = false;
  const result = await validateVisualImage(file(), async () => ({
    width: 8000, height: Math.ceil(MAX_VISUAL_IMAGE_PIXELS / 8000) + 1,
    close() { closed = true; }
  }));
  assert.deepEqual(result, { valid: false, reason: "dimensions" });
  assert.equal(closed, true);
});

test("rejects corrupt images and missing browser decoder safely", async () => {
  assert.deepEqual(await validateVisualImage(file(), async () => { throw new Error("bad image"); }), { valid: false, reason: "decode_failed" });
  assert.deepEqual(await validateVisualImage(file(), null), { valid: false, reason: "decoder_unavailable" });
});
