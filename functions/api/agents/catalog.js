import { listAgents } from "../_lib/agent-router.js";
export async function onRequestGet() {
  return new Response(JSON.stringify({ agents: listAgents(), mode: "coordinated-specialist-roles", autonomousExecution: false, independentAgents: false }), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" }
  });
}
