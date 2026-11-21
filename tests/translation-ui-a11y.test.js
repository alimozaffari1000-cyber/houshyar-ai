import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/translation-ui.js", import.meta.url), "utf8");

test("translation panel is exposed as a named region", () => {
  assert.ok(source.includes('panel.setAttribute("aria-labelledby", "translation-title")'));
  assert.ok(source.includes('<h2 id="translation-title">'));
});

test("translation result remains announced and direction-aware", () => {
  assert.ok(source.includes('id="translation-status" class="translation-status" role="status" aria-live="polite"'));
  assert.ok(source.includes('class="translation-result" dir="auto"'));
});
