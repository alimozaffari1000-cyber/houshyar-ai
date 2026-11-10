import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('D1 schema stores password hashes and salts, not plaintext password fields', async () => {
  const sql = await readFile(new URL('../migrations/0001_identity_usage_security.sql', import.meta.url), 'utf8');
  assert.match(sql, /password_hash TEXT NOT NULL/);
  assert.match(sql, /password_salt TEXT NOT NULL/);
  assert.doesNotMatch(sql, /\bpassword\s+TEXT\b/i);
});

test('sessions store hashed tokens and support expiry and revocation', async () => {
  const sql = await readFile(new URL('../migrations/0001_identity_usage_security.sql', import.meta.url), 'utf8');
  assert.match(sql, /token_hash TEXT NOT NULL UNIQUE/);
  assert.match(sql, /expires_at INTEGER NOT NULL/);
  assert.match(sql, /revoked_at INTEGER/);
});

test('schema supports usage accounting, rate limits, and audit records', async () => {
  const sql = await readFile(new URL('../migrations/0001_identity_usage_security.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS usage_events/);
  assert.match(sql, /estimated_cost_microunits/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS api_rate_limits/);
  assert.match(sql, /PRIMARY KEY \(bucket_key, window_start\)/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS audit_events/);
});

test('D1 setup guide clearly states migration does not activate auth or rate limiting', async () => {
  const doc = await readFile(new URL('../docs/D1-SECURITY-FOUNDATION-FA.md', import.meta.url), 'utf8');
  assert.match(doc, /migration/i);
  assert.match(doc, /به‌تنهایی احراز هویت یا rate limiting را فعال نمی‌کنند/);
  assert.match(doc, /binding/);
});

test('conversation history is isolated by user and indexed by recent activity', async () => {
  const sql = await readFile(new URL('../migrations/0011_conversation_history.sql', import.meta.url), 'utf8');
  assert.match(sql, /user_id TEXT NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(sql, /messages_json TEXT NOT NULL/);
  assert.match(sql, /message_count INTEGER NOT NULL/);
  assert.match(sql, /idx_conversations_user_updated/);
  assert.match(sql, /ON conversations\(user_id, updated_at DESC\)/);
});
