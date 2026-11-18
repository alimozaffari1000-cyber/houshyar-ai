export const AGENT_SCOPES = Object.freeze({
  general: ["knowledge:read"], research: ["knowledge:read", "sources:read"],
  analyst: ["knowledge:read", "data:read", "payment:create"], content: ["knowledge:read", "content:draft", "communication:send", "legal:commit"],
  translator: ["knowledge:read", "content:draft"], planner: ["knowledge:read", "workflow:draft"],
  developer: ["knowledge:read", "code:draft", "tests:run:sandbox", "data:delete", "security:change", "publish:release"]
});

const TOOL_POLICIES = Object.freeze({
  "knowledge.search": { scope: "knowledge:read", effect: "read", approval: false },
  "sources.lookup": { scope: "sources:read", effect: "read", approval: false },
  "data.read": { scope: "data:read", effect: "read", approval: false },
  "content.draft": { scope: "content:draft", effect: "draft", approval: false },
  "workflow.draft": { scope: "workflow:draft", effect: "draft", approval: false },
  "code.draft": { scope: "code:draft", effect: "draft", approval: false },
  "tests.run.sandbox": { scope: "tests:run:sandbox", effect: "sandbox", approval: false },
  "message.send": { scope: "communication:send", effect: "external_write", approval: true },
  "payment.create": { scope: "payment:create", effect: "financial", approval: true },
  "data.delete": { scope: "data:delete", effect: "destructive", approval: true },
  "security.change": { scope: "security:change", effect: "security_sensitive", approval: true },
  "publish.release": { scope: "publish:release", effect: "public_release", approval: true },
  "contract.accept": { scope: "legal:commit", effect: "legal_commitment", approval: true }
});

export function evaluateAgentAction({ agentId, tool, grantedScopes = [], humanApproved = false } = {}) {
  const policy = TOOL_POLICIES[tool];
  if (!policy) return { allowed: false, reason: "UNKNOWN_TOOL", requiresApproval: false };
  const scopes = Array.isArray(grantedScopes) ? grantedScopes : [];
  const agentScopes = AGENT_SCOPES[agentId] || [];
  if (!agentScopes.includes(policy.scope) || !scopes.includes(policy.scope)) {
    return { allowed: false, reason: "SCOPE_NOT_GRANTED", requiresApproval: policy.approval };
  }
  if (policy.approval && humanApproved !== true) {
    return { allowed: false, reason: "HUMAN_APPROVAL_REQUIRED", requiresApproval: true };
  }
  return { allowed: true, reason: "AUTHORIZED", requiresApproval: policy.approval, effect: policy.effect };
}

export function listAgentPolicies() {
  return Object.entries(AGENT_SCOPES).map(([id, scopes]) => ({ id, scopes: [...scopes] }));
}

export function listToolPolicies() {
  return Object.entries(TOOL_POLICIES).map(([id, policy]) => ({ id, ...policy }));
}
