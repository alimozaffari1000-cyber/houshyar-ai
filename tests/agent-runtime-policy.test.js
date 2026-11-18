import test from "node:test";
import assert from "node:assert/strict";
import { validateRuntimeTask, getRuntimeCapabilities } from "../functions/api/_lib/agent-runtime-policy.js";

test("only explicitly typed deterministic tasks can be dispatched", () => {
  const result = validateRuntimeTask({ taskType: "translation_catalog_audit" });
  assert.equal(result.allowed, true);
  assert.equal(result.task.externalEffects, false);
  assert.equal(result.task.agentId, "translator");
});

test("legacy free-text requests are never auto-executed", () => {
  assert.equal(validateRuntimeTask({ taskType: "assistant_request" }).reason, "TASK_TYPE_NOT_AUTOMATABLE");
});

test("unknown and dangerous task types fail closed", () => {
  for (const taskType of ["unknown", "shell_command", "production_deploy", "payment", "code_change"]) {
    assert.equal(validateRuntimeTask({ taskType }).allowed, false);
  }
});

test("payload must be valid JSON object with only allowlisted fields", () => {
  assert.equal(validateRuntimeTask({ taskType: "agent_team_audit", payloadJson: "[]" }).reason, "INVALID_PAYLOAD");
  assert.equal(validateRuntimeTask({ taskType: "agent_team_audit", payloadJson: "{" }).reason, "INVALID_PAYLOAD");
  assert.equal(validateRuntimeTask({ taskType: "agent_team_audit", payloadJson: '{"command":"rm -rf"}' }).reason, "UNSUPPORTED_PAYLOAD_FIELD");
});

test("only queued tasks can be dispatched", () => {
  assert.equal(validateRuntimeTask({ taskType: "project_health_report", status: "in_progress" }).reason, "TASK_NOT_QUEUED");
});

test("runtime capabilities explicitly deny shell, writes, and external effects", () => {
  const caps = getRuntimeCapabilities();
  assert.equal(caps.freeTextExecution, false);
  assert.equal(caps.shellExecution, false);
  assert.equal(caps.repositoryWrites, false);
  assert.equal(caps.productionWrites, false);
  assert.equal(caps.externalEffects, false);
  assert.equal(caps.requiresSeparateWorkerDeployment, true);
});
