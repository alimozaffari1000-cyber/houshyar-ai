import test from "node:test";
import assert from "node:assert/strict";
import { createRepairPlan } from "../scripts/repair-advisor.mjs";

test("repair advisor classifies known findings and always requires human approval", () => {
  const plan = createRepairPlan({ findings: [
    { code: "SECURITY_ADVISORY", source: "npm-audit", observedAt: "2026-11-17T10:00:00Z" },
    { code: "PROVIDER_UNAVAILABLE", source: "runtime.health" }
  ] });
  assert.equal(plan.mode, "advisory_only");
  assert.equal(plan.automaticChangesAllowed, false);
  assert.equal(plan.productionActionsAllowed, false);
  assert.equal(plan.approvalRequired, true);
  assert.equal(plan.findings[0].severity, "critical");
  assert.equal(plan.findings[0].mode, "human_approval");
});

test("repair advisor ignores unknown and malformed findings without echoing input", () => {
  const secret = "do-not-print-this-secret";
  const plan = createRepairPlan({ findings: [
    { code: "UNKNOWN", details: secret },
    null,
    { code: "BUILD_FAILED", source: secret }
  ] });
  assert.equal(plan.findings.length, 1);
  assert.equal(plan.ignoredFindingCount, 2);
  assert.equal(JSON.stringify(plan).includes(secret), false);
  assert.equal(plan.findings[0].source, "unspecified");
});

test("empty findings produce a no-action plan", () => {
  const plan = createRepairPlan({ findings: [] });
  assert.equal(plan.approvalRequired, false);
  assert.equal(plan.findings.length, 0);
});
