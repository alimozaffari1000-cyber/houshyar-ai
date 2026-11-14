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
test("developer requests receive security and quality review roles", () => {
  const result = routeAgentRequest("کد من را بررسی کن");
  assert.deepEqual(result.team.map(member => member.id), ["developer", "security", "quality"]);
  assert.match(result.instruction, /اعتبارسنجی ورودی/);
  assert.equal(result.coordinationMode, "single_model_coordinated_roles");
  assert.equal(result.autonomousTools, false);
});
test("complex requests add a risk reviewer without granting tools", () => {
  const result = routeAgentRequest("این پروژه را از صفر طراحی و راه‌اندازی کن");
  assert.ok(result.team.some(member => member.id === "risk"));
  assert.equal(result.autonomousTools, false);
});
test("agent catalog exposes specialists and review roles", () => {
  const agents = listAgents();
  assert.ok(agents.some(agent => agent.id === "developer"));
  assert.ok(agents.some(agent => agent.id === "security" && agent.role === "reviewer"));
  assert.ok(agents.every(agent => agent.status === "available" || agent.status === "review_role"));
});
