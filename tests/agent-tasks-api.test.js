import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet, onRequestPost } from "../functions/api/agent-tasks.js";
import { onRequestPost as cancelTask } from "../functions/api/agent-tasks/[id]/cancel.js";

function mockDb({ openCount = 0, changes = 1 } = {}) {
  const writes = [];
  return {
    writes,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes("SELECT users.id")) return { id: "user-1", email: "user@example.test", role: "user" };
              return { total: openCount };
            },
            async all() { return { results: [] }; },
            sql,
            args,
            async run() { writes.push({ sql, args }); return { meta: { changes } }; }
          };
        }
      };
    },
    async batch(statements) {
      for (const statement of statements) writes.push({ sql: statement.sql, args: statement.args });
      return statements.map(() => ({ meta: { changes } }));
    }
  };
}
function makeRequest(path, { method = "GET", body, origin = "https://example.test" } = {}) {
  return new Request("https://example.test" + path, {
    method,
    headers: {
      Cookie: "houshyar_session=test-session-token",
      ...(method === "POST" ? { Origin: origin, "Content-Type": "application/json" } : {})
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}
const env = DB => ({ DB, AUTH_ENABLED: "true" });

test("creates an authenticated queued task without claiming execution", async () => {
  const DB = mockDb();
  const response = await onRequestPost({
    request: makeRequest("/api/agent-tasks", { method: "POST", body: { goal: "برای من یک برنامه یادگیری طراحی کن" } }),
    env: env(DB)
  });
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.task.status, "queued");
  assert.equal(body.execution, "not_started");
  assert.equal(body.task.workflow.executionMode, "plan_only");
  assert.equal(DB.writes.length, 2);
  assert.equal(DB.writes[0].args[1], "user-1");
  assert.match(DB.writes[1].sql, /agent_task_events/);
  assert.match(DB.writes[1].sql, /task\.created/);
});

test("holds consequential tasks for explicit human approval", async () => {
  const DB = mockDb();
  const response = await onRequestPost({
    request: makeRequest("/api/agent-tasks", { method: "POST", body: { goal: "برای من پرداخت را انجام بده" } }),
    env: env(DB)
  });
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.task.status, "needs_approval");
  assert.equal(body.task.approvalRequired, true);
  assert.equal(body.execution, "not_started");
  assert.match(DB.writes[1].sql, /agent_task_events/);
});

test("rejects cross-origin task creation", async () => {
  const response = await onRequestPost({
    request: makeRequest("/api/agent-tasks", { method: "POST", origin: "https://attacker.example", body: { goal: "کار عادی" } }),
    env: env(mockDb())
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "ORIGIN_NOT_ALLOWED");
});

test("enforces the per-user active task limit", async () => {
  const response = await onRequestPost({
    request: makeRequest("/api/agent-tasks", { method: "POST", body: { goal: "کار عادی" } }),
    env: env(mockDb({ openCount: 10 }))
  });
  assert.equal(response.status, 429);
  assert.equal((await response.json()).error, "TASK_LIMIT_REACHED");
});

test("lists only the authenticated user's task collection", async () => {
  const response = await onRequestGet({ request: makeRequest("/api/agent-tasks"), env: env(mockDb()) });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).tasks, []);
});

test("cancels only a queued task owned by the authenticated user", async () => {
  const DB = mockDb();
  const id = "123e4567-e89b-12d3-a456-426614174000";
  const response = await cancelTask({
    request: makeRequest("/api/agent-tasks/" + id + "/cancel", { method: "POST", body: {} }),
    env: env(DB),
    params: { id }
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "cancelled");
  assert.match(DB.writes[0].sql, /user_id = \?/);
  assert.match(DB.writes[1].sql, /task\.cancelled/);
});

test("does not claim cancellation when no owned cancellable task changed", async () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";
  const response = await cancelTask({
    request: makeRequest("/api/agent-tasks/" + id + "/cancel", { method: "POST", body: {} }),
    env: env(mockDb({ changes: 0 })),
    params: { id }
  });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "TASK_NOT_CANCELLABLE");
});
