import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../migrations/0008_developer_platform_foundation.sql', import.meta.url), 'utf8');

test('developer platform separates profiles, projects, keys, apps, versions and usage', () => {
  for (const table of ['developer_profiles', 'developer_projects', 'developer_api_keys', 'developer_apps', 'developer_app_versions', 'developer_usage_events']) {
    assert.match(migration, new RegExp('CREATE TABLE IF NOT EXISTS ' + table));
  }
});

test('API credentials store hashes and prefixes, never raw bearer secrets', () => {
  assert.match(migration, /secret_hash TEXT NOT NULL UNIQUE/);
  assert.match(migration, /key_prefix TEXT NOT NULL/);
  assert.doesNotMatch(migration, /raw_key|api_key_value|bearer_token\s+TEXT/i);
  assert.match(migration, /revoked_at INTEGER/);
  assert.match(migration, /expires_at INTEGER/);
});

test('apps require review before public catalog visibility can be used', () => {
  assert.match(migration, /visibility IN \('private', 'unlisted', 'public'\)/);
  assert.match(migration, /review_status IN \('draft', 'submitted', 'approved', 'rejected', 'suspended'\)/);
  assert.match(migration, /permissions_json TEXT NOT NULL DEFAULT '\[\]'/);
});

test('usage ledger is non-negative and supports idempotency', () => {
  assert.match(migration, /estimated_cost_microunits INTEGER NOT NULL DEFAULT 0/);
  assert.match(migration, /idx_developer_usage_idempotency/);
  assert.match(migration, /WHERE idempotency_key IS NOT NULL/);
});
