import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/translation-ui.js", import.meta.url), "utf8");

test("translator input follows the direction of the first typed text", () => {
  assert.match(source, /<textarea id="translation-input" dir="auto"/);
  assert.match(source, /<label class="translation-input-label" for="translation-input">/);
});

test("translator output remains direction-aware", () => {
  assert.match(source, /id="translation-result" class="translation-result" dir="auto"/);
});
