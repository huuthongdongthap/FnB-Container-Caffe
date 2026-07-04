/**
 * Service Worker - Full Offline Support
 * AURA CAFE Cafe
 *
 * Cache strategy:
 *   STATIC (cache-first)  -> pre-cached shell assets: /, index.html, CSS, JS
 *   API    (network-first) -> /api/* requests, stale-while-revalidate fallback
 *   NAV    (network-only)  -> any other navigation route (no caching)
 */

const STATIC_CACHE = 'aura-static-v1';
const API_QUEUE_CACHE = 'aura-api-queue-v1';
const CACHE_VERSION = 'aura-v1';

// ---- Pre-cache list (critical shell assets) ----
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/images/favicon.svg',
  '/images/favicon-192x192.png',
  '/images/favicon-512x512.png'
];

// ---- Install: populate static cache ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ---- Activate: wipe stale caches ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== API_QUEUE_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ---- Message: allow client-triggered skipWaiting ----
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ---- Route helpers ----
function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isStaticAsset(url) {
  const exts = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.woff2', '.woff', '.ttf'];
  return exts.some((ext) => url.pathname.endsWith(ext));
}

function isNavigation(url) {
  return url.pathname === '/' || (
    !isApiRequest(url) &&
    !isStaticAsset(url) &&
    !url.pathname.match(/\.\w{2,5}$/)
  );
}

// ---- Fetch: strategy per route type ----
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Static assets: cache-first
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // API requests: network-first, stale-on-failure
  if (isApiRequest(url)) {
    event.respondWith(networkFirst(event.request, url));
    return;
  }

  // Navigation (SPA shell): network-first, fallback to cached /
  if (isNavigation(url)) {
    event.respondWith(networkFirst(event.request, url));
    return;
  }

  // Everything else: network-only
  // (no respondWith → browser default)
});

// ---- Cache-first strategy ----
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

// ---- Network-first strategy (with offline fallback & queue) ----
async function networkFirst(request, url) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      // Only cache navigations — do NOT cache API responses aggressively
      if (isNavigation(url)) {
        caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
      }
    }
    return response;
  } catch {
    // Navigation: fall back to cached index.html (SPA shell)
    if (isNavigation(url)) {
      const fallback = await caches.match('/');
      if (fallback) return fallback;
      const fallback2 = await caches.match('/index.html');
      if (fallback2) return fallback2;
    }

    // API: queue for retry when back online
    if (isApiRequest(url)) {
      await queueRequest(request);
      return new Response(JSON.stringify({ offline: true, queued: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Offline', { status: 503 });
  }
}

// ---- Queue failed API requests for retry ----
async function queueRequest(request) {
  const cache = await caches.open(API_QUEUE_CACHE);
  const key = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Clone the request body as text so we can store it
  const body = await request.clone().text();
  const queued = new Response(JSON.stringify({
    url: request.url,
    method: request.method,
    headers: [...request.headers.entries()],
    body: body || null,
    timestamp: Date.now()
  }), { headers: { 'Content-Type': 'application/json' } });

  await cache.put(key, queued);

  // Register a background sync to retry
  if ('sync' in self.registration) {
    self.registration.sync.register('retry-queued-api').catch(() => {});
  }
}

// ---- Push notifications ----
self.addEventListener('push', (event) => {
  let data;
  try {
    data = event.data ? JSON.parse(event.data.text()) : {};
  } catch {
    data = {};
  }

  const title = data.title || 'AURA CAFE Cafe';
  const options = {
    body: data.body || 'Don hang cua ban da san sang!',
    icon: '/images/favicon-192x192.png',
    badge: '/images/favicon-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
      url: data.url || '/'
    },
    actions: [
      { action: 'view', title: 'Xem don hang' },
      { action: 'close', title: 'Dong' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ---- Notification click ----
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/?tab=orders';

  if (event.action === 'view') {
    event.waitUntil(clients.openWindow(targetUrl));
  }
});

// ---- Background sync: retry queued API requests ----
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOrders());
  }
  if (event.tag === 'retry-queued-api') {
    event.waitUntil(retryQueuedRequests());
  }
});

async function syncOrders() {
  try {
    const payload = { synced: true, timestamp: Date.now() };
    await fetch('/api/orders/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch {
    // Will retry on next sync event
  }
}

async function retryQueuedRequests() {
  const cache = await caches.open(API_QUEUE_CACHE);
  const keys = await cache.keys();

  for (const key of keys) {
    try {
      const entry = await cache.match(key);
      if (!entry) continue;

      const data = await entry.json();
      const response = await fetch(data.url, {
        method: data.method || 'GET',
        headers: data.headers ? Object.fromEntries(data.headers) : {},
        body: data.body || null
      });

      if (response.ok) {
        await cache.delete(key);
      }
    } catch {
      // Leave in cache for next retry cycle
    }
  }
}
