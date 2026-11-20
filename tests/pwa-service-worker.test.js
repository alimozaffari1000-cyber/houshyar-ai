import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('هوش‌یار در مرورگرهای امن Service Worker را ثبت می‌کند', async () => {
  const js = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(js, /'serviceWorker' in navigator/);
  assert.match(js, /register\('\/sw\.js'\)/);
});

test('پوسته آفلاین فقط فایل‌های عمومی برنامه را cache می‌کند و API را مستثنا می‌کند', async () => {
  const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(sw, /\/api\//);
  assert.match(sw, /request\.method !== 'GET'/);
  assert.match(sw, /url\.origin !== self\.location\.origin/);
  assert.match(sw, /request\.mode === 'navigate'/);
  assert.match(sw, /\/assets\//);
  assert.match(sw, /\/brand\//);
  assert.doesNotMatch(sw, /cache\.addAll\(\[[^\]]*\/api\//s);
});
