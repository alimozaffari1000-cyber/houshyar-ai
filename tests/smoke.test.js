import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('صفحه اصلی و ورودی برنامه وجود دارند', async () => {
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const js=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(html,/id="app"/);
  assert.match(html,/type="module"/);
  assert.match(js,/function render/);
  assert.match(js,/chat-form/);
});
test('ورودی کاربر قبل از نمایش escape می‌شود', async () => {
  const js=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(js,/escapeHTML/);
  assert.match(js,/replace\(\/\[&<>"'\]/);
});

test('پیش‌نویس پیام هنگام انتظار برای پاسخ حفظ می‌شود', async () => {
  const js=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
  assert.ok(js.includes("draft: ''"));
  assert.ok(js.includes('${escapeHTML(state.draft)}'));
  assert.ok(js.includes("prompt.addEventListener('input',()=>{state.draft=prompt.value;resize();});"));
  assert.ok(js.includes("state.draft='';\n  state.messages.push"));
});


test('scrolling chat respects the reduced-motion accessibility preference', async () => {
  const js=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(js,/prefers-reduced-motion/);
  assert.match(js,/behavior: prefersReducedMotion \? 'auto' : 'smooth'/);
  assert.ok(js.includes('scrollChat();'));
});

test('source declares chat scrolling only once', async () => {
  const js=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
  const declarations=js.match(/const scrollChat =/g) || [];
  assert.equal(declarations.length,1);
});

test('سند اصلی زبان فارسی و جهت راست‌به‌چپ را اعلام می‌کند', async () => {
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const htmlTag=html.split('\\n').find(line=>line.includes('<html')) || '';
  assert.ok(htmlTag.includes('lang="fa"'));
  assert.ok(htmlTag.includes('dir="rtl"'));
});
