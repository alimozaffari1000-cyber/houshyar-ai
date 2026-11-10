import test from 'node:test';
import assert from 'node:assert/strict';
import { adJson, readAdsJson, safeHttpsUrl, validText, checkAdsRateLimit } from '../functions/api/_lib/ads.js';

test('advertising API responses are private and can include retry headers', async () => {
  const response = adJson({ ok: false }, 429, { 'Retry-After': '12' });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Retry-After'), '12');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
});

test('bounded JSON parser rejects invalid and oversized bodies', async () => {
  assert.equal((await readAdsJson(new Request('https://example.test', { method: 'POST', body: '{bad' }))).error, 'INVALID_JSON');
  assert.equal((await readAdsJson(new Request('https://example.test', { method: 'POST', body: '[]' }))).error, 'INVALID_BODY');
  assert.equal((await readAdsJson(new Request('https://example.test', { method: 'POST', body: JSON.stringify({ text: 'x'.repeat(100) }) }), 20)).error, 'BODY_TOO_LARGE');
  assert.deepEqual(await readAdsJson(new Request('https://example.test', { method: 'POST', body: JSON.stringify({ title: 'کمپین' }) })), { body: { title: 'کمپین' } });
});

test('campaign destination must be a credential-free HTTPS URL', () => {
  assert.equal(safeHttpsUrl('http://example.com'), null);
  assert.equal(safeHttpsUrl('javascript:alert(1)'), null);
  assert.equal(safeHttpsUrl('https://user:pass@example.com'), null);
  assert.equal(safeHttpsUrl('https://example.com/path'), 'https://example.com/path');
  assert.equal(safeHttpsUrl('not a url'), null);
});

test('campaign text validation enforces non-empty bounded strings', () => {
  assert.equal(validText('عنوان', 100), true);
  assert.equal(validText(' ', 100), false);
  assert.equal(validText('x'.repeat(101), 100), false);
});

test('advertising rate limit uses hashed IP key and bounded counter', async () => {
  let bound;
  const db = { prepare(sql) {
    assert.match(sql, /ON CONFLICT/);
    return { bind(...args) { bound = args; return { async first() { return { request_count: 3 }; } }; } };
  } };
  const request = new Request('https://example.test/api/ads/events', { headers: { 'cf-connecting-ip': '203.0.113.9' } });
  const result = await checkAdsRateLimit({ db, request, action: 'event', limit: 2, now: 120 });
  assert.equal(result.allowed, false);
  assert.equal(result.retryAfter, 60);
  assert.match(bound[0], /^ads:event:[a-f0-9]{64}$/);
  assert.equal(bound[1], 120);
});
