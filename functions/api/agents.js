import { listAgents } from "./_lib/agent-router.js";
import { listAgentPolicies, listToolPolicies } from "./_lib/agent-policy.js";

const json = (body) => new Response(JSON.stringify(body), {
  headers: { "Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff" }
});

export async function onRequestGet() {
  return json({
    service: "Houshyar Agent Registry",
    execution: "prompt_routed_single_model",
    autonomousToolExecution: false,
    approvalRequiredFor: ["external_messages","payments","data_deletion","security_changes","public_release","legal_commitments"],
    agents: listAgents(),
    agentScopes: listAgentPolicies(),
    toolPolicies: listToolPolicies()
  });
}
