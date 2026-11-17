import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { onRequestGet, onRequestPut } from "../functions/api/workspace/sync.js";

const origin = "https://houshyar.example";
function makeDb({ row = null, session = true, rate = true } = {}) {
  let stored = row;
  const db = {
    prepare(sql) {
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async first() {
          if (sql.includes("SELECT users.id")) return session ? { id: "user-1", email: "user@example.test", role: "user" } : null;
          if (sql.includes("SELECT revision, payload_json")) return stored;
          if (sql.includes("SELECT revision FROM workspace_snapshots")) return stored ? { revision: stored.revision } : null;
          if (sql.includes("INSERT INTO api_rate_limits")) return rate ? { request_count: 1 } : null;
          if (sql.includes("INSERT INTO workspace_snapshots")) {
            if (stored) return null;
            stored = { revision: 1, payloadJson: args[1], updatedAt: args[2] };
            return { revision: 1 };
          }
          if (sql.includes("UPDATE workspace_snapshots")) {
            if (!stored || stored.revision !== args[3]) return null;
            stored = { revision: stored.revision + 1, payloadJson: args[0], updatedAt: args[1] };
            return { revision: stored.revision };
          }
          return null;
        }
      };
    },
    get stored() { return stored; }
  };
  return db;
}
function request(path, { method = "GET", body, headers = {} } = {}) {
  return new Request(origin + path, {
    method,
    headers: {
      cookie: "houshyar_session=valid-session",
      origin,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers
    },
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) })
  });
}
const envFor = DB => ({ DB, AUTH_ENABLED: "true" });

test("workspace sync requires a signed-in account", async () => {
  const response = await onRequestGet({ request: request("/api/workspace/sync"), env: envFor(makeDb({ session: false })) });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "AUTH_REQUIRED");
});

test("workspace sync GET returns an empty revision for a new account", async () => {
  const response = await onRequestGet({ request: request("/api/workspace/sync"), env: envFor(makeDb()) });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { revision: 0, workspace: { history: [], projects: [] } });
});

test("workspace sync GET normalizes stored snapshots before returning them", async () => {
  const db = makeDb({ row: { revision: 3, payloadJson: JSON.stringify({
    history: [{ id: "chat-1", title: "  Safe title  ", createdAt: "2026-01-01T00:00:00.000Z", messages: [
      { role: "system", text: "must not be returned" }, { role: "user", text: "hello" }
    ] }],
    projects: [{ id: "project-1", title: "  Safe project  ", prompt: "prompt", createdAt: "2026-01-01T00:00:00.000Z", secret: "must not be returned" }]
  }), updatedAt: 10 } });
  const response = await onRequestGet({ request: request("/api/workspace/sync"), env: envFor(db) });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.workspace.history[0].title, "Safe title");
  assert.deepEqual(body.workspace.history[0].messages, [{ role: "user", text: "hello" }]);
  assert.deepEqual(body.workspace.projects[0], { id: "project-1", title: "Safe project", prompt: "prompt", createdAt: "2026-01-01T00:00:00.000Z" });
});

test("workspace sync PUT validates origin, content type, and body", async () => {
  const db = makeDb();
  const badOrigin = await onRequestPut({ request: request("/api/workspace/sync", { method: "PUT", body: { revision: 0, workspace: { history: [], projects: [] } }, headers: { origin: "https://attacker.example" } }), env: envFor(db) });
  assert.equal(badOrigin.status, 403);
  const badType = await onRequestPut({ request: request("/api/workspace/sync", { method: "PUT", body: "{}", headers: { "content-type": "text/plain" } }), env: envFor(db) });
  assert.equal(badType.status, 415);
  const badBody = await onRequestPut({ request: request("/api/workspace/sync", { method: "PUT", body: "{bad" }), env: envFor(db) });
  assert.equal(badBody.status, 400);
});

test("workspace sync stores only normalized user-owned records and advances revision", async () => {
  const db = makeDb();
  const response = await onRequestPut({
    request: request("/api/workspace/sync", { method: "PUT", body: {
      revision: 0,
      workspace: {
        history: [{ id: "chat-1", title: "  گفت‌وگو  ", createdAt: "2026-01-01T00:00:00.000Z", messages: [
          { role: "system", text: "discard" }, { role: "user", text: "سلام" }, { role: "assistant", text: "پاسخ" }
        ] }],
        projects: [{ id: "project-1", title: "  پروژه  ", prompt: "طرح", createdAt: "2026-01-01T00:00:00.000Z" }]
      }
    } }),
    env: envFor(db)
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).revision, 1);
  const stored = JSON.parse(db.stored.payloadJson);
  assert.equal(stored.history[0].title, "گفت‌وگو");
  assert.deepEqual(stored.history[0].messages.map(item => item.role), ["user", "assistant"]);
  assert.equal(stored.projects[0].title, "پروژه");
});

test("workspace sync uses optimistic revisions and does not overwrite concurrent updates", async () => {
  const db = makeDb({ row: { revision: 2, payloadJson: JSON.stringify({ history: [], projects: [] }), updatedAt: 1 } });
  const response = await onRequestPut({
    request: request("/api/workspace/sync", { method: "PUT", body: { revision: 1, workspace: { history: [], projects: [] } } }),
    env: envFor(db)
  });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).currentRevision, 2);
});

test("workspace sync refuses payloads beyond the request limit", async () => {
  const db = makeDb();
  const response = await onRequestPut({
    request: request("/api/workspace/sync", { method: "PUT", body: "x".repeat(256 * 1024 + 1) }),
    env: envFor(db)
  });
  assert.equal(response.status, 413);
});

test("workspace sync migration is documented and references account ownership", async () => {
  const sql = await readFile(new URL("../migrations/0013_workspace_cloud_sync.sql", import.meta.url), "utf8");
  assert.match(sql, /workspace_snapshots/);
  assert.match(sql, /user_id TEXT PRIMARY KEY REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(sql, /revision INTEGER NOT NULL/);
  assert.match(sql, /payload_json TEXT NOT NULL/);
});

test("workspace sync fails closed when rate-limit storage is unavailable", async () => {
  const response = await onRequestGet({ request: request("/api/workspace/sync"), env: envFor(makeDb({ rate: false })) });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "AUTH_RATE_LIMIT_UNAVAILABLE");
});

test("workspace sync responses are never cacheable", async () => {
  const response = await onRequestGet({ request: request("/api/workspace/sync"), env: envFor(makeDb()) });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

test("workspace sync PUT rejects requests without an Origin header", async () => {
  const noOrigin = new Request(origin + "/api/workspace/sync", {
    method: "PUT",
    headers: { cookie: "houshyar_session=valid-session", "content-type": "application/json" },
    body: JSON.stringify({ revision: 0, workspace: { history: [], projects: [] } })
  });
  const response = await onRequestPut({ request: noOrigin, env: envFor(makeDb()) });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "ORIGIN_NOT_ALLOWED");
});

test("workspace sync does not expose corrupt stored snapshots", async () => {
  const db = makeDb({ row: { revision: 4, payloadJson: "{broken-json", updatedAt: 20 } });
  const response = await onRequestGet({ request: request("/api/workspace/sync"), env: envFor(db) });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "WORKSPACE_DATA_UNAVAILABLE");
});

test("workspace sync refuses to operate when account authentication is disabled", async () => {
  const response = await onRequestGet({ request: request("/api/workspace/sync"), env: { DB: makeDb(), AUTH_ENABLED: "false" } });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "AUTH_NOT_CONFIGURED");
});

test("workspace sync PUT requires authentication before accepting workspace data", async () => {
  const response = await onRequestPut({
    request: request("/api/workspace/sync", { method: "PUT", body: { revision: 0, workspace: { history: [], projects: [] } } }),
    env: envFor(makeDb({ session: false }))
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "AUTH_REQUIRED");
});
