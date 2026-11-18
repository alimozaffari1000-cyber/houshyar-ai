import test from "node:test";
import assert from "node:assert/strict";
import { buildTranslationPrompt } from "../src/translator.js";
test("translation prompt includes source, target and original text", () => { const p=buildTranslationPrompt({source:"Persian",target:"English",text:"سلام دنیا"}); assert.match(p,/Source language: Persian/); assert.match(p,/Target language: English/); assert.match(p,/سلام دنیا/); });
test("translation prompt requests faithful translation", () => { const p=buildTranslationPrompt({target:"French",text:"Good morning"}); assert.match(p,/Automatically detect/); assert.match(p,/Do not summarize, explain or add facts/); });
test("translation prompt rejects missing target or text", () => { assert.throws(()=>buildTranslationPrompt({text:"Hello"}),/TARGET_AND_TEXT_REQUIRED/); assert.throws(()=>buildTranslationPrompt({target:"Spanish",text:" "}),/TARGET_AND_TEXT_REQUIRED/); });
test("translation prompt bounds user-controlled fields", () => { const p=buildTranslationPrompt({source:"s".repeat(100),target:"t".repeat(100),text:"x".repeat(6000)}); assert.ok(p.includes("s".repeat(80))); assert.ok(p.includes("t".repeat(80))); assert.ok(p.includes("x".repeat(5000))); assert.ok(!p.includes("x".repeat(5001))); });
