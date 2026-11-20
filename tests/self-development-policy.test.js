import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSelfDevelopmentAction, getSelfDevelopmentCapabilities } from "../functions/api/_lib/self-development-policy.js";

test("allows safe repository work in development branch", () => {
  for (const action of ["inspect_repository","analyze_code","research_public_sources","create_development_plan","create_work_branch","run_tests","run_security_scan","build_preview","open_pull_request"]) {
    assert.equal(evaluateSelfDevelopmentAction(action).allowed, true, action);
  }
});

test("allows code writes only on isolated agent branches", () => {
  assert.equal(evaluateSelfDevelopmentAction("write_branch_changes", {branch:"agent/translator-improvements"}).allowed, true);
  assert.equal(evaluateSelfDevelopmentAction("write_branch_changes", {branch:"main"}).reason, "UNSAFE_BRANCH");
  assert.equal(evaluateSelfDevelopmentAction("write_branch_changes", {branch:"agent/main"}).reason, "UNSAFE_BRANCH");
});

test("requires explicit approval for production and sensitive operations", () => {
  for (const action of ["merge_to_main","deploy_production","run_production_migration","delete_user_data","create_or_move_payment","change_billing_or_secrets"]) {
    const result = evaluateSelfDevelopmentAction(action);
    assert.equal(result.allowed, false, action);
    assert.equal(result.requiresApproval, true, action);
    assert.equal(evaluateSelfDevelopmentAction(action,{humanApproved:true}).allowed, true, action);
  }
});

test("blocks all autonomous writes in production environment", () => {
  assert.equal(evaluateSelfDevelopmentAction("write_branch_changes",{environment:"production"}).allowed, false);
  assert.equal(evaluateSelfDevelopmentAction("run_tests",{environment:"production"}).reason, "PRODUCTION_ENVIRONMENT_BLOCKED");
});

test("prohibits unrestricted shell, disabled checks and audit tampering even with approval", () => {
  for (const action of ["execute_unrestricted_shell","disable_security_checks","hide_audit_events","exfiltrate_secrets","modify_audit_history"]) {
    assert.equal(evaluateSelfDevelopmentAction(action,{humanApproved:true}).allowed, false, action);
  }
});

test("unknown actions fail closed", () => {
  assert.equal(evaluateSelfDevelopmentAction("invented_action").reason, "UNKNOWN_ACTION_DENY_BY_DEFAULT");
  assert.equal(evaluateSelfDevelopmentAction("").reason, "INVALID_ACTION");
});

test("capability report explicitly excludes production and direct main writes", () => {
  const capabilities = getSelfDevelopmentCapabilities();
  assert.equal(capabilities.productionWrites, false);
  assert.equal(capabilities.directMainWrites, false);
  assert.equal(capabilities.unrestrictedShell, false);
});
