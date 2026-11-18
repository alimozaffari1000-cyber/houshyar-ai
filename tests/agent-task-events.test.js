import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/agent-tasks/[id]/events.js";

const taskId = "123e4567-e89b-12d3-a456-426614174000";
const request = (query = "") => new Request(
  "https://example.test/api/agent-tasks/" + taskId + "/events" + query,
  { headers: { Cookie: "houshyar_session=test-session-token" } }
);

function mockDb({ task = true, events = [] } = {}) {
  const queries = [];
  return {
    queries,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              queries.push({ kind: "first", sql, args });
              if (sql.includes("SELECT users.id")) {
                return { id: "user-1", email: "user@example.test", role: "user" };
              }
              return task ? { id: taskId } : null;
            },
            async all() {
              queries.push({ kind: "all", sql, args });
              return { results: events };
            }
          };
        }
      };
    }
  };
}

const env = DB => ({ DB, AUTH_ENABLED: "true" });

test("returns a bounded owner-scoped event page without private metadata", async () => {
  const DB = mockDb({
    events: [
      { id: "event-3", event_type: "task.cancelled", actor_type: "user", created_at: 30, metadata_json: "private" },
      { id: "event-2", event_type: "task.approval_recorded", actor_type: "user", created_at: 20, metadata_json: "private" },
      { id: "event-1", event_type: "task.created", actor_type: "user", created_at: 10, metadata_json: "private" }
    ]
  });
  const response = await onRequestGet({
    request: request("?limit=2"),
    env: env(DB),
    params: { id: taskId }
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.events, [
    { id: "event-3", type: "task.cancelled", actor: "user", createdAt: 30 },
    { id: "event-2", type: "task.approval_recorded", actor: "user", createdAt: 20 }
  ]);
  assert.deepEqual(body.page, { limit: 2, hasMore: true, nextCursor: "20.event-2" });
  assert.equal("metadata_json" in body.events[0], false);
  assert.match(DB.queries[0].sql, /WHERE id = \? AND user_id = \?/);
  assert.match(DB.queries[1].sql, /WHERE task_id = \? AND user_id = \?/);
  assert.match(DB.queries[1].sql, /ORDER BY created_at DESC, id DESC LIMIT \?/);
  assert.deepEqual(DB.queries[1].args, [taskId, "user-1", 3]);
});

test("uses the cursor as a stable descending timestamp and id boundary", async () => {
  const DB = mockDb({ events: [] });
  const response = await onRequestGet({
    request: request("?limit=5&cursor=1700000000.123e4567-e89b-12d3-a456-426614174000"),
    env: env(DB),
    params: { id: taskId }
  });
  assert.equal(response.status, 200);
  assert.match(DB.queries[1].sql, /created_at < \? OR \(created_at = \? AND id < \?\)/);
  assert.deepEqual(DB.queries[1].args, [
    taskId, "user-1", 1700000000, 1700000000,
    "123e4567-e89b-12d3-a456-426614174000", 6
  ]);
});

test("does not reveal another user's task or its events", async () => {
  const DB = mockDb({ task: false, events: [{ id: "private-event" }] });
  const response = await onRequestGet({
    request: request(),
    env: env(DB),
    params: { id: taskId }
  });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "TASK_NOT_FOUND");
  assert.equal(DB.queries.length, 2);
});

test("rejects malformed identifiers, limits and cursors", async () => {
  const DB = mockDb();
  const invalidId = await onRequestGet({
    request: request(), env: env(DB), params: { id: "bad-id" }
  });
  assert.equal(invalidId.status, 400);

  const invalidLimit = await onRequestGet({
    request: request("?limit=51"), env: env(DB), params: { id: taskId }
  });
  assert.equal(invalidLimit.status, 400);

  const invalidCursor = await onRequestGet({
    request: request("?cursor=not-a-cursor"), env: env(DB), params: { id: taskId }
  });
  assert.equal(invalidCursor.status, 400);
  assert.equal(DB.queries.length, 0);
});

test("requires authentication and configured task storage", async () => {
  const unavailable = await onRequestGet({
    request: request(), env: {}, params: { id: taskId }
  });
  assert.equal(unavailable.status, 503);

  const unauthenticatedDb = {
    prepare() {
      return { bind() { return { async first() { return null; } }; } };
    }
  };
  const unauthenticated = await onRequestGet({
    request: request(), env: env(unauthenticatedDb), params: { id: taskId }
  });
  assert.equal(unauthenticated.status, 401);
});
