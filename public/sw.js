const CACHE_PREFIX = 'houshyar-shell-';
const CACHE_NAME = CACHE_PREFIX + 'v1';
const APP_SHELL = ['/', '/favicon.svg', '/brand/mark.svg'];

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
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Never cache API, authentication, account, or other dynamic responses.
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('/', copy));
        }
        return response;
      }).catch(async () => {
        const cached = await caches.match('/');
        return cached || new Response('هوش‌یار در حال حاضر آفلاین است. برای گفتگو دوباره به اینترنت وصل شوید.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })
    );
    return;
  }

  if (!['script', 'style', 'image', 'font'].includes(request.destination)) return;

  event.respondWith(
    caches.match(request).then(cached => {
      const update = fetch(request).then(response => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || update;
    })
  );
});
