import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/agent-tasks/[id]/approve.js";

function mockDb({ changes = 1, user = true } = {}) {
  const writes = [];
  return {
    writes,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              return user ? { id: "user-1", email: "user@example.test", role: "user" } : null;
            },
            async run() {
              writes.push({ sql, args });
              return { meta: { changes } };
            }
          };
        }
      };
    }
  };
}

function request(id) {
  return new Request("https://example.test/api/agent-tasks/" + id + "/approve", {
    method: "POST",
    headers: {
      Cookie: "houshyar_session=test-session-token",
      Origin: "https://example.test"
    }
  });
}

const id = "123e4567-e89b-12d3-a456-426614174000";

test("records approval for an owned task without executing it", async () => {
  const DB = mockDb();
  const response = await onRequestPost({
    request: request(id), env: { DB, AUTH_ENABLED: "true" }, params: { id }
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, "queued");
  assert.equal(body.execution, "not_started");
  assert.match(DB.writes[0].sql, /user_id = \?/);
  assert.match(DB.writes[0].sql, /approval_required = 1/);
  assert.match(DB.writes[0].sql, /status = 'needs_approval'/);
});

test("does not report approval when task is not owned, expired, or already changed", async () => {
  const response = await onRequestPost({
    request: request(id), env: { DB: mockDb({ changes: 0 }), AUTH_ENABLED: "true" }, params: { id }
  });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "TASK_NOT_APPROVABLE");
});

test("requires a valid task identifier", async () => {
  const response = await onRequestPost({
    request: request("not-an-id"), env: { DB: mockDb(), AUTH_ENABLED: "true" }, params: { id: "not-an-id" }
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "INVALID_TASK_ID");
});
