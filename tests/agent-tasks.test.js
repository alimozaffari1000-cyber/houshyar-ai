import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { requiresHumanApproval, taskTitle, safeTaskRecord } from "../functions/api/_lib/agent-tasks.js";

test("flags consequential task requests for human approval", () => {
  assert.equal(requiresHumanApproval("برای حسابم پرداخت انجام بده"), true);
  assert.equal(requiresHumanApproval("این تغییر را deploy کن"), true);
  assert.equal(requiresHumanApproval("این متن را ترجمه کن"), false);
});

test("normalizes and bounds task titles", () => {
  assert.equal(taskTitle("  یک   کار جدید  "), "یک کار جدید");
  assert.equal(taskTitle("x".repeat(200)).length, 160);
});

test("serializes task rows without exposing internal database columns", () => {
  const result = safeTaskRecord({
    id: "task-id", title: "title", goal: "goal", agent_id: "planner",
    workflow_json: JSON.stringify({ executionMode: "plan_only" }),
    status: "queued", approval_required: 0, created_at: 1, updated_at: 2, expires_at: 3,
    user_id: "private-user-id", error_code: "internal"
  });
  assert.equal(result.agentId, "planner");
  assert.deepEqual(result.workflow, { executionMode: "plan_only" });
  assert.equal("user_id" in result, false);
  assert.equal("error_code" in result, false);
});

test("D1 task queue enforces per-user ownership, bounded goal, expiry and safe states", async () => {
  const sql = await readFile(new URL("../migrations/0009_agent_tasks.sql", import.meta.url), "utf8");
  assert.match(sql, /user_id TEXT NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(sql, /length\(goal\) BETWEEN 1 AND 4000/);
  assert.match(sql, /'queued', 'needs_approval', 'running', 'completed', 'failed', 'cancelled'/);
  assert.match(sql, /approval_required INTEGER NOT NULL/);
  assert.match(sql, /expires_at INTEGER NOT NULL/);
  assert.match(sql, /idx_agent_tasks_user_created/);
});


test("D1 task event audit schema is bounded and excludes private content fields", async () => {
  const sql = await readFile(new URL("../migrations/0010_agent_task_events.sql", import.meta.url), "utf8");
  assert.match(sql, /task_id TEXT NOT NULL REFERENCES agent_tasks\(id\) ON DELETE CASCADE/);
  assert.match(sql, /user_id TEXT NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(sql, /'task.created'.*'task.approval_recorded'.*'task.cancelled'/s);
  assert.match(sql, /length\(metadata_json\) <= 2048/);
  assert.doesNotMatch(sql, /prompt|password|secret|token/i);
});
