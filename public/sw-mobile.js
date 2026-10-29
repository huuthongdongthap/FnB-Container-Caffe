const CACHE_NAME = 'aura-mobile-v2';
const STATIC_ASSETS = [
  '/',
  '/mobile',
  '/offline.html',
  '/manifest-mobile.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Authenticated responses and mobile API aliases must never survive logout.
  // A network failure stays a failure; an old user's cached body is not a fallback.
  if (req.method !== 'GET' || req.headers.has('Authorization')
      || url.pathname.startsWith('/api/')
      || url.pathname.startsWith('/mobile/')) {
    event.respondWith(fetch(req));
    return;
  }

  // Static: cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone));
        }
        return res;
      });
    })
  );
});
