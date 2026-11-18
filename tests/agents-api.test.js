import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/agents.js";
test("agent registry endpoint is read-only and discloses non-autonomous execution mode", async () => {
  const response = await onRequestGet();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.equal(body.autonomousToolExecution, false);
  assert.equal(body.execution, "prompt_routed_single_model");
  assert.ok(body.agents.some(agent => agent.id === "translator"));
  assert.ok(body.agentScopes.some(agent => agent.id === "developer"));
  assert.ok(body.toolPolicies.some(tool => tool.id === "payment.create" && tool.approval === true));
});
