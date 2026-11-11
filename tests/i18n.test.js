import test from "node:test";
import assert from "node:assert/strict";
import { localeOptions, translate, localeDirection } from "../src/i18n.js";

test("locale foundation includes Persian, English and multiple global languages", () => {
  const codes = localeOptions.map(item => item.code);
  for (const code of ["fa", "en", "de", "ar", "tr", "es", "fr", "ru", "zh", "hi", "ur", "pt"]) assert.ok(codes.includes(code));
});

test("locale dictionaries expose core interface labels with fallback", () => {
  assert.equal(translate("send", "en"), "Send ↑");
  assert.equal(translate("send", "fa"), "ارسال ↑");
  assert.equal(translate("unknown-key", "en"), "unknown-key");
});

test("right-to-left and left-to-right directions are explicit", () => {
  assert.equal(localeDirection("fa"), "rtl");
  assert.equal(localeDirection("ar"), "rtl");
  assert.equal(localeDirection("en"), "ltr");
  assert.equal(localeDirection("de"), "ltr");
});
