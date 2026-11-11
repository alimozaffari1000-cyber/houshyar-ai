import test from "node:test";
import assert from "node:assert/strict";
import { routeAgentRequest, listAgents } from "../functions/api/_lib/agent-router.js";

test("routes translation, coding, analysis, research, content and planning tasks", () => {
  assert.equal(routeAgentRequest("این متن را به انگلیسی ترجمه کن").id, "translator");
  assert.equal(routeAgentRequest("این JavaScript code را debug کن").id, "developer");
  assert.equal(routeAgentRequest("سهام را از نظر ریسک تحلیل کن").id, "analyst");
  assert.equal(routeAgentRequest("برای این موضوع تحقیق کن و منابع بده").id, "research");
  assert.equal(routeAgentRequest("یک متن تبلیغاتی بنویس").id, "content");
  assert.equal(routeAgentRequest("یک نقشه راه مرحله به مرحله بده").id, "planner");
  assert.equal(routeAgentRequest("سلام").id, "general");
});

test("agent routing never grants autonomous tool permissions", () => {
  const result = routeAgentRequest("کد من را بررسی کن");
  assert.equal(result.executionMode, "single_model_specialist");
  assert.equal(result.autonomousTools, false);
});

test("agent catalog exposes the available specialist roles", () => {
  assert.ok(listAgents().length >= 7);
  assert.ok(listAgents().every(agent => agent.status === "available"));
});
