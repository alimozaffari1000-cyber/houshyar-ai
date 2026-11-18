import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync("config/agent-team.json", "utf8"));
const errors = [];
const warnings = [];
const agents = Array.isArray(config.agents) ? config.agents : [];
const ids = agents.map(agent => agent.id);

if (config.version !== 1) errors.push("Unsupported agent-team config version");
if (!config.project) errors.push("Project identifier is required");
if (agents.length !== 10) errors.push("Expected exactly 10 registered specialist roles");
if (new Set(ids).size !== ids.length) errors.push("Agent identifiers must be unique");

const requiredRoles = ["orchestrator","research","architect","developer","qa","security","translator","commerce","growth","guardian"];
for (const role of requiredRoles) if (!ids.includes(role)) errors.push("Missing required role: " + role);

for (const agent of agents) {
  if (!agent.name || !agent.domain || !Array.isArray(agent.permissions) || !agent.permissions.length) {
    errors.push("Incomplete agent definition: " + (agent.id || "unknown"));
  }
  if (agent.autonomousChanges !== false) {
    errors.push("Unreviewed autonomous code changes must remain disabled: " + agent.id);
  }
  if (!["queued","hourly","daily","weekly","on_demand_and_daily","on_pull_request_and_daily"].includes(agent.schedule)) {
    errors.push("Unsupported schedule for " + agent.id + ": " + agent.schedule);
  }
}

const limits = config.globalLimits || {};
for (const key of ["denyByDefault","noArbitraryCodeExecution","noRawSecretAccessInAgentPrompts","allActionsAudited","allCodeChangesRequirePullRequest","productionChangesRequireHumanApproval"]) {
  if (limits[key] !== true) errors.push("Required safety limit must be true: " + key);
}
if (!Array.isArray(config.approvalRequiredFor) || !config.approvalRequiredFor.includes("production_deploy") || !config.approvalRequiredFor.includes("database_migration")) {
  errors.push("Production deployment and database migrations must require human approval");
}

const cloud = config.executionModes?.cloud;
const local = config.executionModes?.local;
if (!cloud?.enabled || cloud.requiresConfiguredRuntime !== true) errors.push("Cloud mode must be enabled in design and explicitly require runtime configuration");
if (local?.enabled !== false || local.requiresInstalledLocalRunner !== true) errors.push("Local mode must remain marked unavailable until a local runner is installed");

if (errors.length) {
  console.error("AGENT TEAM AUDIT: FAILED");
  errors.forEach(item => console.error("- " + item));
  process.exit(1);
}

console.log("AGENT TEAM AUDIT: PASS");
console.log("Registered roles: " + agents.length);
console.log("Cloud runtime: " + (cloud.requiresConfiguredRuntime ? "configuration required; not assumed active" : "ready"));
console.log("Offline runtime: " + (local.enabled ? "enabled" : "not installed; offline execution is not claimed"));
console.log("Autonomous code changes: disabled; PR review required");
console.log("Human approval gates: " + config.approvalRequiredFor.length);
if (warnings.length) warnings.forEach(item => console.warn("WARNING: " + item));
