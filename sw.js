// Service Worker for PWA - Offline Support & Caching

const CACHE_NAME = 'fnb-caffe-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/main.js',
    '/js/theme.js',
    '/js/menu.js',
    '/js/cart.js',
    '/js/checkout.js',
    '/manifest.json',
    '/assets/icons/favicon-192.png',
    '/assets/icons/favicon-512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .catch((err) => console.error('Cache addAll error:', err))
    );
    self.skipWaiting();
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
    );
    self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin)) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Clone response for cache
                const responseClone = response.clone();

                // Cache successful responses
                if (response.status === 200) {
                    caches.open(CACHE_NAME)
                        .then((cache) => cache.put(event.request, responseClone));
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
                            return caches.match('/index.html');
                        }

                        return new Response('Offline', { status: 503 });
                    });
            })
    );
});

// Background sync for orders
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-orders') {
        event.waitUntil(syncOrders());
    }
});

async function syncOrders() {
    const orders = JSON.parse(localStorage.getItem('pending-orders') || '[]');

    for (const order of orders) {
        try {
            await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(order)
            });

            // Remove synced order
            const remaining = orders.filter(o => o.id !== order.id);
            localStorage.setItem('pending-orders', JSON.stringify(remaining));
        } catch (error) {
            console.error('Sync order failed:', error);
        }
    }
}

// Push notifications
self.addEventListener('push', (event) => {
    const data = event.data?.json() || {};
    const { title, body, icon, badge } = data;

    event.waitUntil(
        self.registration.showNotification(title || 'F&B Caffe', {
            body: body || 'Bạn có thông báo mới',
            icon: icon || '/assets/icons/favicon-192.png',
            badge: badge || '/assets/icons/favicon-192.png',
            data: data.data
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.notification.data?.url) {
        event.waitUntil(
            clients.openWindow(event.notification.data.url)
        );
    }
});
