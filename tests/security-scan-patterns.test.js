import test from "node:test";
import assert from "node:assert/strict";
import { SECRET_PATTERNS } from "../scripts/secret-patterns.js";

function patternFor(name) {
  return SECRET_PATTERNS.find(([label]) => label === name)?.[1];
}

test("secret scanner recognizes long Anthropic API key formats", () => {
  const pattern = patternFor("Anthropic API key");
  const candidate = ["sk", "ant", "api03", "A".repeat(40)].join("-");

  assert.ok(pattern instanceof RegExp);
  assert.equal(pattern.test(candidate), true);
  assert.equal(pattern.test("sk-ant-short"), false);
});

test("secret scanner recognizes Google API key formats", () => {
  const pattern = patternFor("Google API key");
  const candidate = ["AI", "za", "B".repeat(35)].join("");

  assert.ok(pattern instanceof RegExp);
  assert.equal(pattern.test(candidate), true);
  assert.equal(pattern.test("AIza-short"), false);
});

test("secret scanner keeps named patterns unique and regular-expression based", () => {
  const names = SECRET_PATTERNS.map(([name]) => name);

  assert.equal(new Set(names).size, names.length);
  assert.ok(SECRET_PATTERNS.every(([name, pattern]) => typeof name === "string" && pattern instanceof RegExp));
});
