import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('صفحه اصلی manifest نصب‌پذیری هوش‌یار را معرفی می‌کند', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(html, /name="mobile-web-app-capable" content="yes"/);
  assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
});

test('manifest نام، زبان، جهت و آیکون برند را تعریف می‌کند', async () => {
  const raw = await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8');
  const manifest = JSON.parse(raw);
  assert.equal(manifest.name, 'هوش‌یار | دستیار هوشمند');
  assert.equal(manifest.short_name, 'هوش‌یار');
  assert.equal(manifest.lang, 'fa');
  assert.equal(manifest.dir, 'rtl');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some(icon => icon.src === '/brand/mark.svg' && icon.type === 'image/svg+xml'));
});
