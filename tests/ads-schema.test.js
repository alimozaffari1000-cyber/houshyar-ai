import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('advertising migration defines campaigns, deduplicated events and referral attribution', async () => {
  const sql = await readFile(new URL('../migrations/0005_ad_marketplace.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS ad_campaigns/);
  assert.match(sql, /status TEXT NOT NULL DEFAULT 'draft'/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS ad_events/);
  assert.match(sql, /dedupe_key TEXT NOT NULL UNIQUE/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS ad_referral_codes/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS referral_attributions/);
  assert.match(sql, /referred_user_id TEXT NOT NULL UNIQUE/);
});

test('reward ledger is append-only and has no mutable status column', async () => {
  const sql = await readFile(new URL('../migrations/0005_ad_marketplace.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS ad_reward_ledger/);
  assert.match(sql, /trg_ad_reward_ledger_no_update/);
  assert.match(sql, /trg_ad_reward_ledger_no_delete/);
  assert.doesNotMatch(sql, /idx_ad_reward_ledger_status_created/);
  const ledger = sql.split('CREATE TABLE IF NOT EXISTS ad_reward_ledger')[1]?.split(');')[0] || '';
  assert.equal(ledger.includes('status TEXT'), false);
});
