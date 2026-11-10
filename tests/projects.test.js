import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet as listProjects, onRequestPost as createProject } from "../functions/api/projects/index.js";
import { onRequestGet as getProject, onRequestPut as updateProject, onRequestDelete as deleteProject } from "../functions/api/projects/[id].js";
import { normalizeProjectTitle, normalizeProjectDescription, validProjectId, ownedProject } from "../functions/api/projects/_lib.js";
import { validOwnedProject } from "../functions/api/conversations/_lib.js";

const id = "123e4567-e89b-42d3-a456-426614174000";

test("project titles and descriptions are normalized and bounded", () => {
  assert.equal(normalizeProjectTitle("  پروژه   من "), "پروژه من");
  assert.equal(normalizeProjectTitle("  "), "");
  assert.equal(normalizeProjectTitle("x".repeat(100)).length, 80);
  assert.equal(normalizeProjectDescription("  توضیح  "), "توضیح");
  assert.equal(normalizeProjectDescription("x".repeat(600)).length, 500);
});

test("project ids must be UUIDs", () => {
  assert.equal(validProjectId(id), true);
  assert.equal(validProjectId("../other-user"), false);
  assert.equal(validProjectId(""), false);
});

test("project listing fails closed until auth and database are configured", async () => {
  const response = await listProjects({ request: new Request("https://example.test/api/projects"), env: {} });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "PROJECTS_NOT_CONFIGURED");
});

test("project creation rejects cross-origin requests before touching the database", async () => {
  const response = await createProject({
    request: new Request("https://example.test/api/projects", { method: "POST", headers: { origin: "https://attacker.test", "content-type": "application/json" }, body: JSON.stringify({ title: "Private" }) }),
    env: { AUTH_ENABLED: "true", DB: { prepare() { throw new Error("must not query"); } } }
  });
  assert.equal(response.status, 403);
});

test("project detail and mutations reject malformed ids", async () => {
  const request = new Request("https://example.test/api/projects/not-a-uuid", { headers: { origin: "https://example.test", "content-type": "application/json" } });
  const env = { AUTH_ENABLED: "true", DB: { prepare() { throw new Error("must not query"); } } };
  assert.equal((await getProject({ request, env, params: { id: "not-a-uuid" } })).status, 404);
  assert.equal((await updateProject({ request: new Request(request.url, { method: "PUT", headers: { origin: "https://example.test", "content-type": "application/json" }, body: JSON.stringify({ title: "x" }) }), env, params: { id: "not-a-uuid" } })).status, 404);
  assert.equal((await deleteProject({ request: new Request(request.url, { method: "DELETE", headers: { origin: "https://example.test" } }), env, params: { id: "not-a-uuid" } })).status, 404);
});

test("project ownership query scopes by both project and user", async () => {
  let sql = ""; let values = [];
  const db = { prepare(query) { sql = query; return { bind(...args) { values = args; return { first: async () => ({ id, user_id: "user-A" }) }; } }; } };
  assert.equal((await ownedProject(db, "user-A", id)).id, id);
  assert.match(sql, /WHERE id = \? AND user_id = \?/);
  assert.deepEqual(values, [id, "user-A"]);
});

test("conversation project association accepts null or an owned project only", async () => {
  assert.equal(await validOwnedProject({}, "user-A", null), true);
  assert.equal(await validOwnedProject({}, "user-A", ""), true);
  assert.equal(await validOwnedProject({}, "user-A", "bad-id"), false);
  const db = { prepare() { return { bind(projectId, userId) { return { first: async () => projectId === id && userId === "user-A" ? { id } : null }; } }; } };
  assert.equal(await validOwnedProject(db, "user-A", id), true);
  assert.equal(await validOwnedProject(db, "user-B", id), false);
});
