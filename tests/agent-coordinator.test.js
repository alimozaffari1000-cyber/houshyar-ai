import test from "node:test";
import assert from "node:assert/strict";
import { planAgentTasks, coordinateAgentRequest } from "../functions/api/_lib/agent-coordinator.js";

test("requires at least two specialist signals and caps the plan at two", () => {
  assert.deepEqual(planAgentTasks("سلام"), []);
  const plan = planAgentTasks("تحقیق کن، تحلیل ریسک بده، و یک نقشه راه برنامه‌ریزی کن");
  assert.equal(plan.length, 2);
  assert.deepEqual(plan.map(item => item.agentId), ["research", "analyst"]);
});

test("empty and invalid requests do not execute specialist work", async () => {
  let calls = 0;
  const result = await coordinateAgentRequest({ message: " ", execute: async () => { calls++; } });
  assert.equal(result.reason, "MESSAGE_REQUIRED");
  assert.equal(calls, 0);
  await assert.rejects(() => coordinateAgentRequest({ message: "تحقیق و تحلیل", execute: null }), TypeError);
});

test("single-specialist requests fall back without calling the executor", async () => {
  let calls = 0;
  const result = await coordinateAgentRequest({ message: "فقط تحقیق کن", execute: async () => { calls++; } });
  assert.equal(result.coordinated, false);
  assert.equal(result.reason, "NO_MULTI_SPECIALIST_PLAN");
  assert.equal(calls, 0);
});

test("runs at most two specialists and one synthesis in deterministic order", async () => {
  const calls = [];
  const result = await coordinateAgentRequest({
    message: "تحقیق کن، تحلیل ریسک بده، برنامه‌ریزی و کدنویسی هم انجام بده",
    execute: async ({ agentId, maxTokens }) => {
      calls.push(agentId);
      assert.ok(maxTokens <= 900);
      return `خروجی ${agentId}`;
    }
  });
  assert.deepEqual(calls, ["research", "analyst", "general"]);
  assert.equal(result.reason, "COMPLETED");
  assert.equal(result.steps.length, 2);
  assert.match(result.reply, /خروجی/);
});

test("partial specialist failure still allows a synthesis from successful work", async () => {
  const result = await coordinateAgentRequest({
    message: "تحقیق کن و تحلیل ریسک بده",
    execute: async ({ agentId }) => {
      if (agentId === "research") throw new Error("provider unavailable");
      return "تحلیل انجام شد";
    }
  });
  assert.equal(result.reason, "PARTIAL");
  assert.deepEqual(result.steps, ["analyst"]);
  assert.equal(result.failures[0].code, "SPECIALIST_FAILED");
});

test("all specialist failures stop before synthesis", async () => {
  const calls = [];
  const result = await coordinateAgentRequest({
    message: "تحقیق کن و تحلیل ریسک بده",
    execute: async ({ agentId }) => { calls.push(agentId); throw new Error("failed"); }
  });
  assert.equal(result.reason, "ALL_SPECIALISTS_FAILED");
  assert.deepEqual(calls, ["research", "analyst"]);
  assert.equal(result.reply, null);
});

test("synthesis failure returns bounded specialist outputs rather than losing work", async () => {
  const result = await coordinateAgentRequest({
    message: "تحقیق کن و تحلیل ریسک بده",
    execute: async ({ agentId }) => {
      if (agentId === "general") throw new Error("failed");
      return "خروجی متخصص";
    }
  });
  assert.equal(result.reason, "SYNTHESIS_FAILED");
  assert.match(result.reply, /خروجی متخصص/);
});
