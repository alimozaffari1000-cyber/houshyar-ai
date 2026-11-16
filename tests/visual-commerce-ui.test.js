import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("visual commerce is integrated as a local-only preview until a provider is configured", async () => {
  const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  const module = await readFile(new URL("../src/visual-commerce.js", import.meta.url), "utf8");
  const validation = await readFile(new URL("../src/visual-image-validation.js", import.meta.url), "utf8");
  assert.match(main, /initVisualCommerce/);
  assert.match(main, /data-open-visual-commerce/);
  assert.match(module, /image\/jpeg/);
  assert.match(module, /image\/png/);
  assert.match(module, /image\/webp/);
  assert.match(module, /validateVisualImage/);
  assert.match(validation, /MAX_VISUAL_IMAGE_BYTES = 8 \* 1024 \* 1024/);
  assert.match(validation, /MAX_VISUAL_IMAGE_PIXELS = 40_000_000/);
  assert.match(validation, /bitmap\?\.close\?\./);
  assert.match(module, /URL\.revokeObjectURL/);
  assert.match(module, /does not upload or store any images|هیچ تصویری به سرور ارسال یا ذخیره نمی‌شود/);
  assert.match(module, /AI image generation is not enabled yet|تولید تصویر هوش مصنوعی هنوز فعال نشده است/);
});
