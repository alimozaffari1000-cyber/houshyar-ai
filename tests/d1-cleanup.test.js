import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("scripts/d1-cleanup.sql", "utf8");
const workflow = readFileSync(".github/workflows/d1-security-cleanup.yml", "utf8");

test("D1 cleanup removes only expired or consumed authentication records", () => {
  assert.match(sql, /DELETE FROM email_verification_tokens[\s\S]*expires_at <= unixepoch\(\) OR consumed_at IS NOT NULL/);
  assert.match(sql, /DELETE FROM password_reset_tokens[\s\S]*expires_at <= unixepoch\(\) OR consumed_at IS NOT NULL/);
  assert.match(sql, /DELETE FROM sessions[\s\S]*expires_at <= unixepoch\(\) OR revoked_at IS NOT NULL/);
  assert.match(sql, /DELETE FROM api_rate_limits[\s\S]*expires_at <= unixepoch\(\)/);
  assert.doesNotMatch(sql, /DELETE FROM (users|usage_events|audit_events)/);
});

test("scheduled cleanup uses remote D1 and requires server-side Cloudflare secrets", () => {
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /secrets\.CLOUDFLARE_API_TOKEN/);
  assert.match(workflow, /secrets\.CLOUDFLARE_ACCOUNT_ID/);
  assert.match(workflow, /d1 execute houshyar-ai-db --remote --file scripts\/d1-cleanup\.sql/);
});

test("identity schema permits pending accounts required by email verification", () => {
  const schema = readFileSync("migrations/0001_identity_usage_security.sql", "utf8");
  assert.match(schema, /status TEXT NOT NULL DEFAULT 'active'[\s\S]*CHECK \(status IN \('pending', 'active', 'suspended', 'deleted'\)\)/);
});
