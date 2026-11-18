import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAgentAction, listAgentPolicies, listToolPolicies } from "../functions/api/_lib/agent-policy.js";
test("unknown tools are denied by default", () => {
  assert.deepEqual(evaluateAgentAction({ agentId: "developer", tool: "shell.exec" }), { allowed:false, reason:"UNKNOWN_TOOL", requiresApproval:false });
});
test("agents cannot use scopes outside their role or user grants", () => {
  assert.equal(evaluateAgentAction({ agentId:"translator", tool:"data.read", grantedScopes:["data:read"] }).reason, "SCOPE_NOT_GRANTED");
  assert.equal(evaluateAgentAction({ agentId:"analyst", tool:"data.read", grantedScopes:[] }).reason, "SCOPE_NOT_GRANTED");
});
test("read and draft operations are allowed only with both role and explicit grant", () => {
  const result = evaluateAgentAction({ agentId:"translator", tool:"content.draft", grantedScopes:["content:draft"] });
  assert.equal(result.allowed, true); assert.equal(result.effect, "draft");
});
test("financial, destructive, publishing and legal actions require human approval", () => {
  for (const tool of ["payment.create","data.delete","security.change","publish.release","contract.accept","message.send"]) {
    const scope = listToolPolicies().find(item => item.id === tool).scope;
    const agentId = tool === "payment.create" ? "analyst" : tool === "data.delete" || tool === "security.change" || tool === "publish.release" ? "developer" : tool === "contract.accept" ? "general" : "content";
    const scopes = [...(listAgentPolicies().find(item => item.id === agentId)?.scopes || []), scope];
    const pending = evaluateAgentAction({ agentId, tool, grantedScopes:scopes });
    assert.equal(pending.allowed, false, tool); assert.equal(pending.reason, "HUMAN_APPROVAL_REQUIRED", tool);
    const approved = evaluateAgentAction({ agentId, tool, grantedScopes:scopes, humanApproved:true });
    assert.equal(approved.allowed, true, tool);
  }
});
test("policy catalog contains unique agents and tools", () => {
  const agents=listAgentPolicies(), tools=listToolPolicies();
  assert.equal(new Set(agents.map(x=>x.id)).size, agents.length);
  assert.equal(new Set(tools.map(x=>x.id)).size, tools.length);
});
