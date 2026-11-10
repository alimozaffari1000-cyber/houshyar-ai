import { listAgents } from "../_lib/agent-router.js";
export async function onRequestGet() {
  return new Response(JSON.stringify({ agents: listAgents(), mode: "specialist-routing", coordination: { available: true, enabledByDefault: false, maxSpecialists: 2, maxModelCalls: 3, externalTools: false }, autonomousExecution: false }), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" }
  });
}
