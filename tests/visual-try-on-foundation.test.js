import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("visual commerce migration adds controlled product try-on metadata", async () => {
  const sql = await readFile(new URL("../migrations/0005_visual_try_on_foundation.sql", import.meta.url), "utf8");
  assert.match(sql, /ALTER TABLE products ADD COLUMN visual_category/);
  assert.match(sql, /'apparel'.*'furniture'.*'decor'/s);
  assert.match(sql, /virtual_try_on_enabled INTEGER NOT NULL DEFAULT 0/);
  assert.match(sql, /CHECK \(virtual_try_on_enabled IN \(0, 1\)\)/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS product_media/);
  assert.match(sql, /REFERENCES products\(id\) ON DELETE CASCADE/);
  assert.match(sql, /content_type IN \('image\/jpeg', 'image\/png', 'image\/webp'\)/);
  assert.match(sql, /object_key TEXT NOT NULL UNIQUE/);
});

test("visual try-on design documents distinct furniture and apparel pipelines and privacy controls", async () => {
  const doc = await readFile(new URL("../docs/VISUAL-TRY-ON-FA.md", import.meta.url), "utf8");
  assert.match(doc, /Virtual staging/);
  assert.match(doc, /Virtual try-on/);
  assert.match(doc, /رضایت صریح/);
  assert.match(doc, /R2/);
  assert.match(doc, /هیچ migration راه‌دوری در این PR اجرا نمی‌شود/);
});
