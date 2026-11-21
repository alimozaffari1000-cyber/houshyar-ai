import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

async function loadServiceWorker({
  fetchImpl = async () => { throw new Error('network unavailable'); },
  cachedResponse = null,
  cachePut = async () => {}
} = {}) {
  const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  const handlers = {};
  const waitUntilPromises = [];
  const cache = { match: async () => cachedResponse, put: cachePut };
  const self = {
    location: { origin: 'https://houshyar.example' },
    addEventListener: (name, handler) => { handlers[name] = handler; },
    skipWaiting: async () => {},
    clients: { claim: async () => {} }
  };
  const caches = {
    match: async () => cachedResponse,
    open: async () => cache,
    keys: async () => [],
    delete: async () => true
  };
  runInNewContext(source, { self, caches, URL, fetch: fetchImpl, Response });
  return { onFetch: handlers.fetch, waitUntilPromises };
}

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

test('درخواست API به Service Worker سپرده یا cache نمی‌شود', async () => {
  let networkCalls = 0;
  const harness = await loadServiceWorker({
    fetchImpl: async () => { networkCalls += 1; throw new Error('unexpected network call'); }
  });
  let responsePromise;
  await harness.onFetch({
    request: { method: 'GET', url: 'https://houshyar.example/api/chat', mode: 'cors' },
    respondWith: promise => { responsePromise = promise; },
    waitUntil: promise => harness.waitUntilPromises.push(promise)
  });
  assert.equal(responsePromise, undefined);
  assert.equal(harness.waitUntilPromises.length, 0);
  assert.equal(networkCalls, 0);
});

test('در حالت قطع اینترنت، مسیر صفحه به پوسته ذخیره‌شده برمی‌گردد', async () => {
  const offlineShell = { marker: 'cached-app-shell' };
  const harness = await loadServiceWorker({ cachedResponse: offlineShell });
  let responsePromise;
  await harness.onFetch({
    request: { method: 'GET', url: 'https://houshyar.example/dashboard', mode: 'navigate' },
    respondWith: promise => { responsePromise = promise; },
    waitUntil: promise => harness.waitUntilPromises.push(promise)
  });
  assert.equal(await responsePromise, offlineShell);
  await Promise.all(harness.waitUntilPromises);
});

test('درخواست غیر GET و منبع خارج از دامنه وارد مسیر cache نمی‌شوند', async () => {
  let networkCalls = 0;
  const harness = await loadServiceWorker({
    fetchImpl: async () => { networkCalls += 1; throw new Error('unexpected network call'); }
  });
  for (const request of [
    { method: 'POST', url: 'https://houshyar.example/api/chat', mode: 'cors' },
    { method: 'GET', url: 'https://cdn.example/library.js', mode: 'no-cors' }
  ]) {
    let responsePromise;
    await harness.onFetch({
      request,
      respondWith: promise => { responsePromise = promise; },
      waitUntil: promise => harness.waitUntilPromises.push(promise)
    });
    assert.equal(responsePromise, undefined);
  }
  assert.equal(harness.waitUntilPromises.length, 0);
  assert.equal(networkCalls, 0);
});

test('ذخیره پوسته و فایل‌های عمومی تا پایان cache write در طول عمر Service Worker نگه داشته می‌شود', async () => {
  for (const request of [
    { method: 'GET', url: 'https://houshyar.example/dashboard', mode: 'navigate' },
    { method: 'GET', url: 'https://houshyar.example/assets/app.js', mode: 'same-origin' }
  ]) {
    let releaseWrite;
    const writeGate = new Promise(resolve => { releaseWrite = resolve; });
    let writeStarted = false;
    let writeFinished = false;
    const harness = await loadServiceWorker({
      fetchImpl: async () => ({
        ok: true,
        type: 'basic',
        clone: () => ({ cached: true })
      }),
      cachePut: async () => {
        writeStarted = true;
        await writeGate;
        writeFinished = true;
      }
    });
    let responsePromise;
    await harness.onFetch({
      request,
      respondWith: promise => { responsePromise = promise; },
      waitUntil: promise => harness.waitUntilPromises.push(promise)
    });

    assert.equal((await responsePromise).ok, true);
    await Promise.resolve();
    assert.equal(harness.waitUntilPromises.length, 1);
    assert.equal(writeStarted, true);
    assert.equal(writeFinished, false);

    releaseWrite();
    await Promise.all(harness.waitUntilPromises);
    assert.equal(writeFinished, true);
  }
});
