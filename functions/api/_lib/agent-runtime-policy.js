const RUNTIME_TASKS = Object.freeze({
  project_health_report: Object.freeze({ payloadKeys: [], agentId: "guardian" }),
  translation_catalog_audit: Object.freeze({ payloadKeys: [], agentId: "translator" }),
  agent_team_audit: Object.freeze({ payloadKeys: [], agentId: "guardian" })
});

const FORBIDDEN_TASK_TYPES = new Set([
  "assistant_request", "code_change", "shell_command", "production_deploy",
  "database_migration", "payment", "external_message", "security_change"
]);

export function validateRuntimeTask({ taskType, payloadJson = null, status = "queued" } = {}) {
  if (status !== "queued") return { allowed: false, reason: "TASK_NOT_QUEUED" };
  if (typeof taskType !== "string" || FORBIDDEN_TASK_TYPES.has(taskType)) {
    return { allowed: false, reason: "TASK_TYPE_NOT_AUTOMATABLE" };
  }
  const definition = RUNTIME_TASKS[taskType];
  if (!definition) return { allowed: false, reason: "UNKNOWN_TASK_TYPE" };

  let payload = {};
  if (payloadJson !== null && payloadJson !== undefined) {
    if (typeof payloadJson !== "string" || payloadJson.length > 4000) {
      return { allowed: false, reason: "INVALID_PAYLOAD" };
    }
    try { payload = JSON.parse(payloadJson); }
    catch { return { allowed: false, reason: "INVALID_PAYLOAD" }; }
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { allowed: false, reason: "INVALID_PAYLOAD" };
  }
  const keys = Object.keys(payload);
  if (keys.some(key => !definition.payloadKeys.includes(key))) {
    return { allowed: false, reason: "UNSUPPORTED_PAYLOAD_FIELD" };
  }
  return {
    allowed: true,
    reason: "SAFE_DETERMINISTIC_TASK",
    task: { taskType, payload, agentId: definition.agentId, externalEffects: false }
  };
}

export function getRuntimeCapabilities() {
  return Object.freeze({
    enabledTaskTypes: Object.keys(RUNTIME_TASKS),
    freeTextExecution: false,
    shellExecution: false,
    repositoryWrites: false,
    productionWrites: false,
    externalEffects: false,
    requiresSeparateWorkerDeployment: true
  });
}
