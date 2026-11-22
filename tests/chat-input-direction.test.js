import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("chat composer detects the direction of multilingual input", async () => {
  const source = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  const promptTag = source.match(/<textarea id="prompt"[^>]*>/)?.[0] || "";
  assert.ok(promptTag.includes('dir="auto"'));
});
