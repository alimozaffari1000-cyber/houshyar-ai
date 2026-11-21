import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Cloudflare deployment configuration stays Pages-first', async () => {
  const wrangler = await readFile(new URL('../wrangler.toml', import.meta.url), 'utf8');
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

  assert.match(wrangler, /^pages_build_output_dir\s*=\s*["']\.\/dist["']\s*$/m);
  assert.equal(packageJson.scripts.build, 'vite build');
});

test('Pages API routes remain in the Cloudflare Pages Functions directory', async () => {
  const chat = await readFile(new URL('../functions/api/chat.js', import.meta.url), 'utf8');
  const databaseHealth = await readFile(new URL('../functions/api/health/db.js', import.meta.url), 'utf8');

  assert.match(chat, /export async function onRequestPost/);
  assert.match(databaseHealth, /export async function onRequestGet/);
});
