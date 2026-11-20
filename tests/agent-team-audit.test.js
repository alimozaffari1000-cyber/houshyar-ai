import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("agent team configuration passes the safety and readiness audit", () => {
  const result = spawnSync(process.execPath, ["scripts/agent-team-audit.mjs"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /AGENT TEAM AUDIT: PASS/);
  assert.match(result.stdout, /Registered roles: 10/);
  assert.match(result.stdout, /Offline runtime: not installed/);
  assert.match(result.stdout, /Autonomous code changes: disabled/);
});
