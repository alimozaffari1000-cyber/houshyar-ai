import test from "node:test";
import assert from "node:assert/strict";
import { buildTaskRegistry, transitionTask } from "../scripts/agent-project-coordinator.mjs";

const now = new Date("2026-11-18T12:00:00.000Z");
const plan = {
  generatedAt: "2026-11-18T11:00:00.000Z",
  priorities: [
    { priority: "P1", area: "Product", task: "Add multilingual glossary", acceptance: "Glossary search works." },
    { priority: "P0", area: "Reliability", task: "Fix failing checks", acceptance: "CI passes." }
  ]
};

test("registry creates stable, role-assigned proposed tasks", () => {
  const first = buildTaskRegistry(plan, undefined, now);
  const second = buildTaskRegistry(plan, undefined, now);
  assert.equal(first.tasks.length, 2);
  assert.equal(first.tasks[0].id, second.tasks[0].id);
  assert.equal(first.tasks[0].ownerRole, "developer");
  assert.equal(first.tasks[1].ownerRole, "qa");
  assert.equal(first.tasks[0].status, "proposed");
});

test("registry preserves reviewed status and history across refreshes", () => {
  const first = buildTaskRegistry(plan, undefined, now);
  const approved = transitionTask(first, first.tasks[0].id, "approved", { humanApproved: true, now });
  const refreshed = buildTaskRegistry(plan, approved, new Date("2026-11-19T12:00:00.000Z"));
  assert.equal(refreshed.tasks[0].status, "approved");
  assert.equal(refreshed.tasks[0].approvalRecorded, true);
  assert.equal(refreshed.tasks[0].history.length, 2);
});

test("approval requires explicit human confirmation", () => {
  const registry = buildTaskRegistry(plan, undefined, now);
  assert.throws(() => transitionTask(registry, registry.tasks[0].id, "approved", { now }), /human approval/i);
});

test("invalid transitions and unknown tasks are rejected", () => {
  const registry = buildTaskRegistry(plan, undefined, now);
  assert.throws(() => transitionTask(registry, registry.tasks[0].id, "done", { humanApproved: true, now }), /Invalid transition/);
  assert.throws(() => transitionTask(registry, "missing", "blocked", { now }), /Task not found/);
});

test("security and product tasks are explicitly human-gated", () => {
  const registry = buildTaskRegistry(plan, undefined, now);
  assert.equal(registry.tasks[0].requiresHumanApproval, true);
  assert.equal(registry.tasks[1].requiresHumanApproval, false);
});
