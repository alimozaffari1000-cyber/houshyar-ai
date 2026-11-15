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

import { resolveResponseMode } from "../functions/api/_lib/agent-router.js";

test("auto mode escalates complex and coding requests to deep reasoning", () => {
  const coding = routeAgentRequest("این JavaScript code را debug کن");
  assert.equal(resolveResponseMode("این JavaScript code را debug کن", "auto", coding), "deep");
  const architecture = "یک معماری امنیتی جامع طراحی کن";
  assert.equal(resolveResponseMode(architecture, "auto", routeAgentRequest(architecture)), "deep");
});

test("auto mode uses fast for short exchanges and balanced for ordinary requests", () => {
  assert.equal(resolveResponseMode("سلام", "auto", routeAgentRequest("سلام")), "fast");
  const ordinary = "لطفاً این موضوع را توضیح بده";
  assert.equal(resolveResponseMode(ordinary, "auto", routeAgentRequest(ordinary)), "balanced");
});

test("explicit response mode always overrides adaptive selection", () => {
  const complex = "یک کد پیچیده را بررسی کن";
  assert.equal(resolveResponseMode(complex, "fast", routeAgentRequest(complex)), "fast");
  const creative = "یک شعار خلاق بنویس";
  assert.equal(resolveResponseMode(creative, "creative", routeAgentRequest(creative)), "creative");
});