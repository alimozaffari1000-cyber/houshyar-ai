import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost, onRequestGet } from '../functions/api/chat.js';

const request = (body) => new Request('https://example.test/api/chat', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
});

test('health endpoint reports API status', async () => {
  const response = await onRequestGet();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'ready');
});

test('rejects empty messages', async () => {
  const response = await onRequestPost({ request: request({ message: '  ' }), env: { GROQ_API_KEY: 'test' } });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'MESSAGE_REQUIRED');
});

test('reports missing secret without calling upstream', async () => {
  const response = await onRequestPost({ request: request({ message: 'سلام' }), env: {} });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'AI_NOT_CONFIGURED');
});

test('forwards chat to Groq and returns the assistant reply', async () => {
  const originalFetch = globalThis.fetch;
  let sent;
  globalThis.fetch = async (_url, options) => {
    sent = JSON.parse(options.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: 'سلام، من هوش‌یار هستم.' } }] }), { status: 200 });
  };
  try {
    const response = await onRequestPost({ request: request({ message: 'سلام', history: [{ role: 'user', text: 'سلام' }] }), env: { GROQ_API_KEY: 'test-key' } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).reply, 'سلام، من هوش‌یار هستم.');
    assert.equal(sent.messages.at(-1).content, 'سلام');
  } finally { globalThis.fetch = originalFetch; }
});
