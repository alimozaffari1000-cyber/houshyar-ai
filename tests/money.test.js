import test from "node:test";
import assert from "node:assert/strict";
import { getCurrencyDefinition, parseMajorAmount, formatMinorAmount } from "../src/payments/money.js";

test("currency definitions use the correct minor-unit exponent", () => {
  assert.equal(getCurrencyDefinition("irr").exponent, 0);
  assert.equal(getCurrencyDefinition("USD").exponent, 2);
  assert.equal(getCurrencyDefinition("KWD").exponent, 3);
  assert.equal(getCurrencyDefinition("XXX"), null);
});

test("major amounts convert to exact integer minor units without floating point", () => {
  assert.equal(parseMajorAmount("1250", "IRR"), 1250);
  assert.equal(parseMajorAmount("12.34", "USD"), 1234);
  assert.equal(parseMajorAmount("1.250", "KWD"), 1250);
  assert.equal(parseMajorAmount("12.345", "USD"), null);
  assert.equal(parseMajorAmount("1.1", "IRR"), null);
  assert.equal(parseMajorAmount(12.34, "USD"), null);
  assert.equal(parseMajorAmount("1e3", "USD"), null);
  assert.equal(parseMajorAmount("-1", "USD"), null);
});

test("minor amounts format without rounding or precision loss", () => {
  assert.equal(formatMinorAmount(1234, "USD"), "12.34");
  assert.equal(formatMinorAmount(1250, "KWD"), "1.250");
  assert.equal(formatMinorAmount(1250, "IRR"), "1250");
  assert.equal(formatMinorAmount(-1, "USD"), null);
  assert.equal(formatMinorAmount(Number.MAX_SAFE_INTEGER + 1, "USD"), null);
});
