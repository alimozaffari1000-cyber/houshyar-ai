import test from "node:test";
import assert from "node:assert/strict";
import { buildDeterministicReport } from "../workers/agent-runtime.js";
test("translation catalog audit reports exactly 100 unique languages", () => {
  const report = buildDeterministicReport("translation_catalog_audit");
  assert.equal(report.languageCount, 100); assert.equal(report.uniqueCodeCount, 100);
  assert.equal(report.hasPersian, true); assert.equal(report.hasEnglish, true); assert.equal(report.result, "pass");
});
test("agent team audit remains read-only and approval gated", () => {
  const report = buildDeterministicReport("agent_team_audit");
  assert.equal(report.configuredRoleCount, 10); assert.equal(report.autonomousCodeChanges, false);
  assert.equal(report.unrestrictedShell, false); assert.equal(report.productionApprovalRequired, true);
});
test("unsupported task type is rejected", () => { assert.throws(() => buildDeterministicReport("shell_command"), /TASK_TYPE_NOT_ALLOWED/); });
