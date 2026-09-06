# Phase 4: Real-Time & Offline Features

**Duration:** Week 4-5  
**Owner:** Realtime Team  
**Dependencies:** Phase 3 (OrderManagementTerminal, MobileTrackPage functional)

---

## 4.1 KDS WebSocket Integration (Durable Objects)

### Architecture
```
┌─────────────────┐     WebSocket      ┌──────────────────────┐
│   Client        │ ◄─────────────────► │  KDS Durable Object  │
│   (React)       │   Order Events      │  (per location)      │
└─────────────────┘                     └──────────┬───────────┘
                                                   │
                                                   ▼
                                          ┌──────────────────────┐
                                          │  D1 Database         │
                                          │  (orders, tickets)   │
                                          └──────────────────────┘
```

### Worker: KDS Durable Object
```typescript
// worker/src/tree/kds/KDSDurableObject.ts
import { DurableObject } from 'cloudflare:workers';

interface KDSState {
  connections: Map<string, WebSocket>; // staffId -> WebSocket
  orders: Map<string, KDSOrder>;       // orderId -> order
  tickets: Map<string, KDSTicket>;     // ticketId -> ticket
}

interface KDSOrder {
  id: string;
  tableId: string;
  items: KDSItem[];
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
  priority: number;
  createdAt: number;
  updatedAt: number;
  assignedTo?: string;
}

interface KDSItem {
  id: string;
  name: string;
  quantity: number;
  modifiers: string[];
  station: 'bar' | 'kitchen' | 'bakery';
  status: 'pending' | 'preparing' | 'ready';
}

export class KDSDurableObject extends DurableObject<KDSState> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      this.state = await this.ctx.get('state') || { connections: new Map(), orders: new Map(), tickets: new Map() };
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/websocket') {
      return this.handleWebSocket(request);
    }
    
    if (url.pathname === '/orders' && request.method === 'GET') {
      return this.handleGetOrders();
    }
    
    if (url.pathname === '/orders' && request.method === 'POST') {
      return this.handleCreateOrder(await request.json());
    }
    
    if (url.pathname.startsWith('/orders/') && request.method === 'PATCH') {
      const orderId = url.pathname.split('/')[2];
      return this.handleUpdateOrder(orderId, await request.json());
    }
    
    return new Response('Not Found', { status: 404 });
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 400 });
    }

    const [client, server] = Object.values(new WebSocketPair());
    await this.handleConnection(server);
    
    return new Response(null, { status: 101, webSocket: client });
  }

  private async handleConnection(ws: WebSocket): Promise<void> {
    ws.accept();
    
    // Authenticate via query param or first message
    let staffId: string | null = null;
    
    ws.addEventListener('message', async (event) => {
      const msg = JSON.parse(event.data as string);
      
      if (msg.type === 'auth') {
        staffId = await this.verifyStaffToken(msg.token);
        if (staffId) {
          this.state.connections.set(staffId, ws);
          ws.send(JSON.stringify({ type: 'auth_ok', staffId }));
          // Send current state
          ws.send(JSON.stringify({ type: 'sync', orders: Array.from(this.state.orders.values()) }));
        } else {
          ws.close(4001, 'Invalid token');
        }
      } else if (msg.type === 'claim' && staffId) {
        await this.claimOrder(msg.orderId, staffId);
      } else if (msg.type === 'update_item' && staffId) {
        await this.updateItemStatus(msg.orderId, msg.itemId, msg.status, staffId);
      } else if (msg.type === 'complete' && staffId) {
        await this.completeOrder(msg.orderId, staffId);
      }
    });
    
    ws.addEventListener('close', () => {
      if (staffId) this.state.connections.delete(staffId);
    });
  }

  private broadcast(event: string, data: unknown): void {
    const message = JSON.stringify({ type: event, data });
    for (const ws of this.state.connections.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }

  private async claimOrder(orderId: string, staffId: string): Promise<void> {
    const order = this.state.orders.get(orderId);
    if (order && order.status === 'pending') {
      order.status = 'preparing';
      order.assignedTo = staffId;
      order.updatedAt = Date.now();
      await this.persist();
      this.broadcast('order_claimed', { orderId, staffId, order });
    }
  }

  private async updateItemStatus(orderId: string, itemId: string, status: KDSItem['status'], staffId: string): Promise<void> {
    const order = this.state.orders.get(orderId);
    if (order) {
      const item = order.items.find(i => i.id === itemId);
      if (item) {
        item.status = status;
        order.updatedAt = Date.now();
        // Check if all items ready
        if (order.items.every(i => i.status === 'ready')) {
          order.status = 'ready';
        }
        await this.persist();
        this.broadcast('item_updated', { orderId, itemId, status, order });
      }
    }
  }

  private async persist(): Promise<void> {
    await this.ctx.put('state', this.state);
  }
}
```

### Worker: KDS Route Binding
```typescript
// worker/src/routes/kds.ts
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';

export const kdsRoutes = new Hono()
  .use('*', authMiddleware)
  .get('/websocket', async (c) => {
    const doId = c.env.KDS_DURABLE_OBJECT.idFromName('sa-dec-main');
    const stub = c.env.KDS_DURABLE_OBJECT.get(doId);
    return stub.fetch(new Request('https://kds/websocket', { 
      headers: { Upgrade: 'websocket' } 
    }));
  })
  .get('/orders', async (c) => {
    const doId = c.env.KDS_DURABLE_OBJECT.idFromName('sa-dec-main');
    const stub = c.env.KDS_DURABLE_OBJECT.get(doId);
    const resp = await stub.fetch('https://kds/orders');
    return c.json(await resp.json());
  })
  .post('/orders', async (c) => {
    const doId = c.env.KDS_DURABLE_OBJECT.idFromName('sa-dec-main');
    const stub = c.env.KDS_DURABLE_OBJECT.get(doId);
    const resp = await stub.fetch('https://kds/orders', { 
      method: 'POST', 
      body: JSON.stringify(await c.req.json()) 
    });
    return c.json(await resp.json());
  });
```

---

## 4.2 Client: useKDS Hook

```typescript
// src/hooks/use-kds.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';

interface KDSOrder {
  id: string;
  tableId: string;
  items: KDSItem[];
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
  priority: number;
  createdAt: number;
  updatedAt: number;
  assignedTo?: string;
}

interface KDSItem {
  id: string;
  name: string;
  quantity: number;
  modifiers: string[];
  station: 'bar' | 'kitchen' | 'bakery';
  status: 'pending' | 'preparing' | 'ready';
}

interface UseKDSOptions {
  station?: 'bar' | 'kitchen' | 'bakery' | 'all';
  onOrderUpdate?: (order: KDSOrder) => void;
  onItemUpdate?: (orderId: string, item: KDSItem) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useKDS(options: UseKDSOptions = {}) {
  const { token } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const [orders, setOrders] = useState<KDSOrder[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageQueueRef = useRef<Array<{ type: string; payload: unknown }>>([]);

  const connect = useCallback(() => {
    if (!token) return;
    
    const wsUrl = `${import.meta.env.VITE_WS_URL}/kds/websocket?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError(null);
      options.onConnect?.();
      // Authenticate
      ws.send(JSON.stringify({ type: 'auth', token }));
      // Flush queue
      messageQueueRef.current.forEach(msg => ws.send(JSON.stringify(msg)));
      messageQueueRef.current = [];
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case 'auth_ok':
          break;
        case 'sync':
          setOrders(msg.orders);
          break;
        case 'order_created':
          setOrders(prev => [...prev, msg.data].sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt));
          break;
        case 'order_claimed':
        case 'item_updated':
          setOrders(prev => prev.map(o => o.id === msg.data.orderId ? msg.data.order : o));
          options.onOrderUpdate?.(msg.data.order);
          if (msg.type === 'item_updated') {
            options.onItemUpdate?.(msg.data.orderId, msg.data.item);
          }
          break;
        case 'order_completed':
          setOrders(prev => prev.filter(o => o.id !== msg.data.orderId));
          break;
        case 'error':
          setError(msg.message);
          break;
      }
    };

    ws.onclose = () => {
      setConnected(false);
      options.onDisconnect?.();
      // Reconnect with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
      reconnectTimeoutRef.current = setTimeout(connect, delay);
      reconnectAttempts.current++;
    };

    ws.onerror = (err) => {
      setError('WebSocket error');
      console.error('KDS WebSocket error:', err);
    };
  }, [token, options]);

  const reconnectAttempts = useRef(0);

  const send = useCallback((type: string, payload: unknown) => {
    const msg = { type, ...payload };
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    } else {
      messageQueueRef.current.push(msg);
    }
  }, []);

  const claimOrder = useCallback((orderId: string) => send('claim', { orderId }), [send]);
  const updateItem = useCallback((orderId: string, itemId: string, status: KDSItem['status']) => 
    send('update_item', { orderId, itemId, status }), [send]);
  const completeOrder = useCallback((orderId: string) => send('complete', { orderId }), [send]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  // Filter by station if specified
  const filteredOrders = options.station && options.station !== 'all'
    ? orders.filter(o => o.items.some(i => i.station === options.station))
    : orders;

  return {
    orders: filteredOrders,
    connected,
    error,
    claimOrder,
    updateItem,
    completeOrder,
    reconnect: connect,
  };
}
```

---

## 4.3 Optimistic UI for Order Status

```typescript
// src/hooks/stores/use-order-management-store.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface OrderManagementState {
  orders: KDSOrder[];
  filters: OrderFilters;
  counts: Record<string, number>;
  actions: {
    setOrders: (orders: KDSOrder[]) => void;
    optimisticClaim: (orderId: string, staffId: string) => void;
    optimisticUpdateItem: (orderId: string, itemId: string, status: KDSItem['status']) => void;
    rollback: (orderId: string, previousOrder: KDSOrder) => void;
  };
}

export const useOrderManagementStore = create<OrderManagementState>()(
  immer((set) => ({
    orders: [],
    filters: { status: 'all', station: 'all', search: '' },
    counts: {},
    actions: {
      setOrders: (orders) => set({ orders }),
      optimisticClaim: (orderId, staffId) => set(state => {
        const order = state.orders.find(o => o.id === orderId);
        if (order) {
          order.status = 'preparing';
          order.assignedTo = staffId;
          order.updatedAt = Date.now();
        }
      }),
      optimisticUpdateItem: (orderId, itemId, status) => set(state => {
        const order = state.orders.find(o => o.id === orderId);
        if (order) {
          const item = order.items.find(i => i.id === itemId);
          if (item) {
            item.status = status;
            order.updatedAt = Date.now();
            if (order.items.every(i => i.status === 'ready')) {
              order.status = 'ready';
            }
          }
        }
      }),
      rollback: (orderId, previousOrder) => set(state => {
        const idx = state.orders.findIndex(o => o.id === orderId);
        if (idx >= 0) state.orders[idx] = previousOrder;
      }),
    },
  }))
);
```

---

## 4.4 Offline Queue for Order Submissions

```typescript
// src/lib/offline-queue.ts
import { openDB } from 'idb';

interface QueuedOrder {
  id: string;
  payload: OrderCreatePayload;
  timestamp: number;
  retries: number;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
}

const DB_NAME = 'aura-offline-queue';
const STORE_NAME = 'orders';

export async function initOfflineDB(): Promise<IDBDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('status', 'status');
        store.createIndex('timestamp', 'timestamp');
      }
    },
  });
}

export async function queueOrder(order: Omit<QueuedOrder, 'id' | 'timestamp' | 'retries' | 'status'>): Promise<string> {
  const db = await initOfflineDB();
  const id = crypto.randomUUID();
  const queued: QueuedOrder = {
    ...order,
    id,
    timestamp: Date.now(),
    retries: 0,
    status: 'pending',
  };
  await db.add(STORE_NAME, queued);
  return id;
}

export async function processOfflineQueue(): Promise<void> {
  const db = await initOfflineDB();
  const pending = await db.getAllFromIndex(STORE_NAME, 'status', 'pending');
  
  for (const order of pending) {
    await db.put(STORE_NAME, { ...order, status: 'syncing' });
    
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order.payload),
      });
      
      if (response.ok) {
        await db.put(STORE_NAME, { ...order, status: 'synced' });
        // Optionally delete after sync confirmation
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      const retries = order.retries + 1;
      if (retries >= 3) {
        await db.put(STORE_NAME, { ...order, status: 'failed', retries });
      } else {
        await db.put(STORE_NAME, { ...order, status: 'pending', retries });
      }
    }
  }
}

// Register Background Sync
if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
  navigator.serviceWorker.ready.then(reg => {
    // Trigger sync when online
    window.addEventListener('online', () => {
      reg.sync.register('sync-orders');
    });
  });
}
```

---

## 4.5 PWA Enhancement

### Service Worker (Workbox)
```typescript
// public/sw.ts (Workbox generateSW config)
import { generateSW } from 'workbox-build';

await generateSW({
  swDest: 'dist/sw.js',
  clientsClaim: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/api\.auracafe\.vn\/menu/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'menu-cache',
        expiration: { maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 },
        plugins: [{ cacheKeyWillBeUsed: async ({ request }) => request.url }],
      },
    },
    {
      urlPattern: /^https:\/\/images\.auracafe\.vn/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'image-cache',
        expiration: { maxEntries: 500, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /^https:\/\/api\.auracafe\.vn\/orders/,
      handler: 'NetworkOnly',
      options: {
        backgroundSync: { name: 'sync-orders' },
      },
    },
  ],
  manifestTransforms: [
    (manifest) => {
      // Add version for cache busting
      return { manifest, warnings: [] };
    },
  ],
});
```

### Push Notifications
```typescript
// worker/src/lib/push-notifications.ts
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:admin@auracafe.vn',
  env.VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY
);

interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function sendPushNotification(
  subscription: PushSubscription,
  payload: { title: string; body: string; icon?: string; data?: Record<string, unknown> }
): Promise<void> {
  await webpush.sendNotification(subscription, JSON.stringify(payload));
}

// Trigger points:
// - Order ready for pickup
// - Payment failed
// - Promotion expiring soon
// - Loyalty tier upgrade
// - Staff shift reminder
```

---

## 4.6 Real-Time Admin Updates

```typescript
// worker/src/routes/admin-realtime.ts
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';

export const adminRealtimeRoutes = new Hono()
  .use('*', authMiddleware)
  .get('/websocket', async (c) => {
    const doId = c.env.ADMIN_DURABLE_OBJECT.idFromName('sa-dec-main');
    const stub = c.env.ADMIN_DURABLE_OBJECT.get(doId);
    return stub.fetch(new Request('https://admin/websocket', { 
      headers: { Upgrade: 'websocket' } 
    }));
  });

// AdminDurableObject broadcasts:
// - order_created, order_updated, order_cancelled
// - staff_online, staff_offline
// - inventory_low_stock
// - payment_received, payment_failed
// - shift_start, shift_end
```

```typescript
// src/hooks/use-admin-realtime.ts
export function useAdminRealtime() {
  const { orders, setOrders } = useOrderManagementStore();
  const { lowStock, setLowStock } = useInventoryStore();
  const { staff, setStaff } = useStaffStore();

  useEffect(() => {
    const ws = new WebSocket(`${import.meta.env.VITE_WS_URL}/admin/websocket`);
    
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case 'order_created':
          setOrders(prev => [msg.data, ...prev]);
          break;
        case 'order_updated':
          setOrders(prev => prev.map(o => o.id === msg.data.id ? msg.data : o));
          break;
        case 'inventory_low_stock':
          setLowStock(msg.data);
          break;
        case 'staff_status':
          setStaff(prev => prev.map(s => s.id === msg.data.id ? { ...s, status: msg.data.status } : s));
          break;
      }
    };
    
    return () => ws.close();
  }, []);
}
```

---

## 4.7 Acceptance Criteria

### KDS WebSocket
- [ ] Durable Object handles 100+ concurrent connections
- [ ] Order events broadcast to all connected staff < 100ms
- [ ] Auto-reconnect works after network interruption
- [ ] Message ordering guaranteed per connection
- [ ] Staff can claim/update/complete orders via WebSocket

### Client Hooks
- [ ] `useKDS` provides real-time orders with optimistic updates
- [ ] Optimistic UI rolls back on server error
- [ ] Connection status reflected in UI (green/red indicator)
- [ ] Works in background tab (no throttling issues)

### Offline Support
- [ ] Menu loads from cache when offline
- [ ] Cart persists in IndexedDB
- [ ] Orders queued when offline, sync on reconnect
- [ ] Background Sync registered for order submission
- [ ] User notified of sync status (toast)

### PWA
- [ ] Install prompt meets A2HS criteria
- [ ] Push notifications work (with permission)
- [ ] Lighthouse PWA score ≥ 90
- [ ] Offline page shows cached menu

### Admin Realtime
- [ ] Dashboard updates without refresh
- [ ] Staff presence indicators accurate
- [ ] Low-stock alerts appear instantly
- [ ] No polling (pure WebSocket)

---

## File Ownership Matrix

| Area | Files | Owner |
|------|-------|-------|
| Worker DO | `worker/src/tree/kds/`, `worker/src/routes/kds.ts` | Backend |
| Client Hooks | `src/hooks/use-kds.ts`, `src/hooks/use-admin-realtime.ts` | Frontend Core |
| Stores | `src/hooks/stores/use-order-management-store.ts` | Frontend Core |
| Offline | `src/lib/offline-queue.ts`, `public/sw.ts` | Frontend Core |
| Push | `worker/src/lib/push-notifications.ts` | Backend |

---

## Rollback Plan
- Feature flag `ENABLE_KDS_WEBSOCKET` gates Durable Object
- Feature flag `ENABLE_OFFLINE_QUEUE` gates IndexedDB queue
- Service worker can be unregistered via `navigator.serviceWorker.getRegistrations()`

---

## Next Phase Dependency
Phase 5 (Localization) can run in parallel.
Phase 6 (Testing) requires all features complete.