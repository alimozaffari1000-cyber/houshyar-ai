import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/agent-tasks/[id].js";

const id = "123e4567-e89b-12d3-a456-426614174000";

function mockDb({ row = null, user = { id: "user-1", email: "user@example.test", role: "user" } } = {}) {
  let query = "";
  let taskArgs = [];
  return {
    get query() { return query; },
    get args() { return taskArgs; },
    prepare(sql) {
      query = sql;
      return {
        bind(...values) {
          if (sql.includes("SELECT users.id")) {
            return { async first() { return user; } };
          }
          taskArgs = values;
          return { async first() { return row; } };
        }
      };
    }
  };
}

function request() {
  return new Request("https://example.test/api/agent-tasks/" + id, {
    headers: { Cookie: "houshyar_session=test-session-token" }
  });
}

test("returns only a task owned by the authenticated user", async () => {
  const DB = mockDb({
    row: {
      id, title: "Task", goal: "Plan", agent_id: "planner",
      workflow_json: JSON.stringify({ executionMode: "plan_only" }),
      status: "queued", approval_required: 0,
      created_at: 1, updated_at: 2, expires_at: 3,
      user_id: "must-not-leak", error_code: "internal"
    }
  });
  const response = await onRequestGet({
    request: request(), env: { DB, AUTH_ENABLED: "true" }, params: { id }
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.task.id, id);
  assert.equal(body.task.workflow.executionMode, "plan_only");
  assert.equal("user_id" in body.task, false);
  assert.equal("error_code" in body.task, false);
  assert.match(DB.query, /WHERE id = \? AND user_id = \?/);
  assert.deepEqual(DB.args, [id, "user-1"]);
});

test("returns not found when the task is not owned by this user", async () => {
  const response = await onRequestGet({
    request: request(), env: { DB: mockDb(), AUTH_ENABLED: "true" }, params: { id }
  });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "TASK_NOT_FOUND");
});

test("rejects malformed task identifiers", async () => {
  const response = await onRequestGet({
    request: request(), env: { DB: mockDb(), AUTH_ENABLED: "true" }, params: { id: "bad" }
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "INVALID_TASK_ID");
});
