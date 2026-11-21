import test from "node:test";
import assert from "node:assert/strict";
import { SUPPORTED_TRANSLATION_LANGUAGES, buildTranslationRequest } from "../src/translation-core.js";

test("translation catalog contains exactly 100 distinct languages", () => {
  assert.equal(SUPPORTED_TRANSLATION_LANGUAGES.length, 100);
  assert.equal(new Set(SUPPORTED_TRANSLATION_LANGUAGES).size, 100);
});

test("builds a translation request with target and source text", () => {
  const prompt = buildTranslationRequest({ text: "Hello", targetLanguage: "Persian" });
  assert.match(prompt, /زبان مقصد: Persian/);
  assert.match(prompt, /Hello/);
  assert.match(prompt, /تشخیص خودکار زبان مبدأ/);
});

test("rejects unsupported target language and empty input", () => {
  assert.throws(() => buildTranslationRequest({ text: "Hi", targetLanguage: "Atlantis" }));
  assert.throws(() => buildTranslationRequest({ text: "  ", targetLanguage: "Persian" }));
});
