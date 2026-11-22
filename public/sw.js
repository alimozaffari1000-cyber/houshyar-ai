const CACHE_NAME = 'houshyar-app-shell-v1';
const APP_SHELL = ['/', '/manifest.webmanifest', '/brand/mark.svg'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('houshyar-app-shell-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    const responsePromise = fetch(request);
    const cachePromise = responsePromise.then(response => {
      if (!response.ok) return;
      return caches.open(CACHE_NAME).then(cache => cache.put('/', response.clone()));
    });
    event.waitUntil(cachePromise.catch(() => {}));
    event.respondWith(
      responsePromise.catch(async () => (await caches.match('/')) || Response.error())
    );
    return;
  }

  const isAppAsset = url.pathname === '/manifest.webmanifest'
    || url.pathname.startsWith('/assets/')
    || url.pathname.startsWith('/brand/');
  if (!isAppAsset) return;

  const cachedResponsePromise = caches.match(request);
  const responsePromise = cachedResponsePromise.then(cached => cached || fetch(request));
  const cachePromise = cachedResponsePromise.then(cached => {
    if (cached) return;
    return responsePromise.then(response => {
      if (response.ok && response.type === 'basic') {
        return caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      }
    });
  });
  event.waitUntil(cachePromise.catch(() => {}));
  event.respondWith(responsePromise);
});
