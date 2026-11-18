const RUNTIME_TASKS = Object.freeze({
  project_health_report: Object.freeze({ payloadKeys: [], agentId: "analyst", title: "گزارش سلامت پروژه" }),
  translation_catalog_audit: Object.freeze({ payloadKeys: [], agentId: "translator", title: "ممیزی کاتالوگ ترجمه" }),
  agent_team_audit: Object.freeze({ payloadKeys: [], agentId: "planner", title: "ممیزی تیم عامل‌ها" })
});
const FORBIDDEN_TASK_TYPES = new Set(["assistant_request", "code_change", "shell_command", "production_deploy", "database_migration", "payment", "external_message", "security_change"]);
export function validateRuntimeTask({ taskType, payload = {}, status = "queued" } = {}) {
  if (status !== "queued") return { allowed: false, reason: "TASK_NOT_QUEUED" };
  if (typeof taskType !== "string" || FORBIDDEN_TASK_TYPES.has(taskType)) return { allowed: false, reason: "TASK_TYPE_NOT_AUTOMATABLE" };
  const definition = RUNTIME_TASKS[taskType];
  if (!definition) return { allowed: false, reason: "UNKNOWN_TASK_TYPE" };
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { allowed: false, reason: "INVALID_PAYLOAD" };
  if (Object.keys(payload).some(key => !definition.payloadKeys.includes(key))) return { allowed: false, reason: "UNSUPPORTED_PAYLOAD_FIELD" };
  return { allowed: true, reason: "SAFE_DETERMINISTIC_TASK", task: { taskType, payload: {}, agentId: definition.agentId, title: definition.title, externalEffects: false } };
}
export function getRuntimeCapabilities() {
  return Object.freeze({ enabledTaskTypes: Object.keys(RUNTIME_TASKS), freeTextExecution: false, shellExecution: false, repositoryWrites: false, productionWrites: false, externalEffects: false, requiresSeparateWorkerDeployment: true });
}
