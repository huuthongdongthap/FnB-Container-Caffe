/**
 * Service Worker - PWA Offline Support
 * AURA CAFE Café
 */

// Cache version — bump via build step or manually on each deploy
// Format: fnb-cache-<YYYYMMDD>-<short-hash>
const CACHE_VERSION = '20260419-01';
const CACHE_NAME = `fnb-cache-${CACHE_VERSION}`;
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/css/styles.css',
  '/js/main.js',
  '/js/theme.js',
  '/js/menu.js',
  '/js/cart.js',
  '/js/checkout.js',
  '/js/i18n.js',
  '/manifest.json',
  '/images/favicon.svg',
  '/images/favicon-192x192.png',
  '/images/favicon-512x512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {return;}

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {return;}

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone response for cache
        const responseClone = response.clone();

        // Cache successful responses
        if (response.status === 200) {
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseClone);
            });
        }

        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }

            // Show offline page for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match('/offline.html');
            }

            return new Response('Offline - No cached version available', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data?.text() || 'Đơn hàng của bạn đã sẵn sàng!',
    icon: '/images/favicon-192x192.png',
    badge: '/images/favicon-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      { action: 'view', title: 'Xem đơn hàng' },
      { action: 'close', title: 'Đóng' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('AURA CAFE Café', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/?tab=orders')
    );
  }
});

// Background sync for orders
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOrders());
  }
});

async function syncOrders() {
  // Sync pending orders when back online
  // Implementation would sync with backend
}
