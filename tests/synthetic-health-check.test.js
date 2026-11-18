import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const run = (url) => spawnSync(process.execPath, ["scripts/synthetic-health-check.mjs"], {
  encoding: "utf8",
  env: { ...process.env, HOUSHYAR_PUBLIC_URL: url }
});

test("synthetic health monitor rejects non-HTTPS targets", () => {
  const result = run("http://example.com");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /HTTPS/);
});

test("synthetic health monitor rejects local and IP-literal targets", () => {
  for (const url of ["https://localhost", "https://127.0.0.1", "https://service.local"]) {
    const result = run(url);
    assert.equal(result.status, 2);
  }
});

test("synthetic health monitor rejects embedded URL credentials", () => {
  const result = run("https://user:password@example.com");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /credentials/);
});
