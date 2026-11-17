import test from "node:test";
import assert from "node:assert/strict";
import { localeOptions, translate } from "../src/i18n.js";

test("API security and quota errors have localized messages for every supported locale", () => {
  const keys = ["errorRateLimited", "errorQuotaExceeded", "errorAuthRequired", "errorRateLimitUnavailable"];
  assert.equal(localeOptions.length, 12);
  for (const { code } of localeOptions) {
    for (const key of keys) {
      const value = translate(key, code);
      assert.equal(typeof value, "string", `${code}:${key} must be a string`);
      assert.ok(value.trim().length > 0, `${code}:${key} must be translated`);
      assert.notEqual(value, key, `${code}:${key} must not fall through to the key name`);
    }
  }
});

test("unknown API error keys retain the existing fallback behavior", () => {
  assert.equal(translate("notARealErrorKey", "fa"), "notARealErrorKey");
});
