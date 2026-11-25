import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('chat transcript exposes chronological log semantics to assistive technology', async () => {
  const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  const chatStart = source.indexOf('<section class="chat" id="chat-section"');
  const chatEnd = source.indexOf('</section>', chatStart);
  assert.ok(chatStart >= 0 && chatEnd > chatStart, 'chat transcript section should exist');
  const chatRegion = source.slice(chatStart, chatEnd);
  assert.match(chatRegion, /role="log"/);
  assert.match(chatRegion, /aria-live="polite"/);
  assert.match(chatRegion, /aria-relevant="additions"/);
  assert.match(chatRegion, /aria-atomic="false"/);
  assert.match(chatRegion, /aria-label="\$\{t\('chatMessagesLabel',locale\)\}"/);
});
