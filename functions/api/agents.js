import { listAgents } from "./_lib/agent-router.js";

export async function onRequestGet() {
  return new Response(JSON.stringify({
    service: "Houshyar specialist catalog",
    executionMode: "single_model_specialist",
    autonomousTools: false,
    agents: listAgents()
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
