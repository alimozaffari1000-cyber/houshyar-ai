import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/translation-ui.js", import.meta.url), "utf8");

test("translation panel is exposed as a named region", () => {
  assert.match(source, /panel\\.setAttribute\\("aria-labelledby",\\s*"translation-title"\\)/);
  assert.match(source, /<h2 id="translation-title">/);
});

test("translation result remains announced and direction-aware", () => {
  assert.match(source, /id="translation-status" class="translation-status" role="status" aria-live="polite"/);
  assert.match(source, /class="translation-result" dir="auto"/);
});
