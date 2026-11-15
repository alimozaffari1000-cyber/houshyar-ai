import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/health/db.js";

const requiredTables = [
  "users", "sessions", "usage_events", "api_rate_limits", "audit_events",
  "daily_usage", "email_verification_tokens", "password_reset_tokens",
  "merchant_stores", "products"
];

function mockDb(names = requiredTables, shouldThrow = false) {
  return {
    prepare(sql) {
      assert.match(sql, /sqlite_master/);
      return {
        async all() {
          if (shouldThrow) throw new Error("private database diagnostic");
          return { results: names.map(name => ({ name })) };
        }
      };
    }
  };
}

test("D1 readiness reports an unconfigured database without leaking details", async () => {
  const response = await onRequestGet({ env: {} });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    status: "database_not_configured",
    databaseConfigured: false,
    databaseReachable: false,
    schemaReady: false
  });
});

test("D1 readiness distinguishes a reachable database with pending migrations", async () => {
  const response = await onRequestGet({ env: { DB: mockDb(requiredTables.slice(0, 5)) } });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.status, "schema_pending");
  assert.equal(body.databaseConfigured, true);
  assert.equal(body.databaseReachable, true);
  assert.equal(body.schemaReady, false);
  assert.equal(JSON.stringify(body).includes("users"), false);
});

test("D1 readiness reports ready only when all application tables exist", async () => {
  const response = await onRequestGet({ env: { DB: mockDb() } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ready",
    databaseConfigured: true,
    databaseReachable: true,
    schemaReady: true
  });
});

test("D1 readiness hides database errors and fails closed", async () => {
  const response = await onRequestGet({ env: { DB: mockDb([], true) } });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.status, "database_unavailable");
  assert.equal(JSON.stringify(body).includes("private database diagnostic"), false);
});
