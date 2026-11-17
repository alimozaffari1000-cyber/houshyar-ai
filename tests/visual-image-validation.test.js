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

test("rejects non-finite file sizes and malformed decoded dimensions", async () => {
  let decodeCalls = 0;
  let closed = 0;
  for (const size of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    const result = await validateVisualImage(file({ size }), async () => {
      decodeCalls += 1;
      return { width: 1, height: 1 };
    });
    assert.deepEqual(result, { valid: false, reason: "unsupported" });
  }
  assert.equal(decodeCalls, 0);

  const invalidDimensions = [
    { width: 0, height: 1 },
    { width: -1, height: 1 },
    { width: 1.5, height: 1 },
    { width: Number.NaN, height: 1 },
    { width: 1, height: Number.POSITIVE_INFINITY }
  ];
  for (const dimensions of invalidDimensions) {
    const result = await validateVisualImage(file(), async () => ({
      ...dimensions,
      close() { closed += 1; }
    }));
    assert.deepEqual(result, { valid: false, reason: "dimensions" });
  }
  assert.equal(closed, invalidDimensions.length);
});

test("rejects corrupt images and missing browser decoder safely", async () => {
  assert.deepEqual(await validateVisualImage(file(), async () => { throw new Error("bad image"); }), { valid: false, reason: "decode_failed" });
  assert.deepEqual(await validateVisualImage(file(), null), { valid: false, reason: "decoder_unavailable" });
});
