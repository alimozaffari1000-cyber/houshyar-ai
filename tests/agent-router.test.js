import test from "node:test";
import assert from "node:assert/strict";
import { routeAgentRequest, listAgents } from "../functions/api/_lib/agent-router.js";

test("routes core specialist tasks", () => {
  assert.equal(routeAgentRequest("این متن را به انگلیسی ترجمه کن").id, "translator");
  assert.equal(routeAgentRequest("این JavaScript code را debug کن").id, "developer");
  assert.equal(routeAgentRequest("سهام را از نظر ریسک تحلیل کن").id, "analyst");
  assert.equal(routeAgentRequest("برای این موضوع تحقیق کن و منابع بده").id, "research");
  assert.equal(routeAgentRequest("یک متن تبلیغاتی بنویس").id, "content");
  assert.equal(routeAgentRequest("یک نقشه راه مرحله به مرحله بده").id, "planner");
  assert.equal(routeAgentRequest("سلام").id, "general");
});

test("routes commerce, visual design, education and security requests", () => {
  assert.equal(routeAgentRequest("نزدیک‌ترین میوه‌فروشی که سفارش و تحویل دارد کجاست؟").id, "commerce");
  assert.equal(routeAgentRequest("لباس را روی عکس خودم امتحان کن").id, "visual_designer");
  assert.equal(routeAgentRequest("مبل را در عکس اتاقم قرار بده").id, "visual_designer");
  assert.equal(routeAgentRequest("این موضوع را از صفر به من آموزش بده").id, "educator");
  assert.equal(routeAgentRequest("امنیت سایت را از نظر نفوذ بررسی کن").id, "security");
});

test("agent routing never grants autonomous tool permissions", () => {
  for (const message of ["کد من را بررسی کن", "فروشگاه نزدیک من", "امنیت سایت", "این درس را آموزش بده"]) {
    const result = routeAgentRequest(message);
    assert.equal(result.executionMode, "single_model_specialist");
    assert.equal(result.autonomousTools, false);
  }
});

test("agent catalog exposes all specialist roles without claiming autonomous execution", () => {
  const agents = listAgents();
  assert.ok(agents.length >= 11);
  assert.ok(agents.every(agent => agent.status === "available"));
  assert.ok(agents.some(agent => agent.id === "commerce"));
  assert.ok(agents.some(agent => agent.id === "visual_designer"));
});
