/**
 * Offline Queue — Client-side order queue for WiFi-resilient checkout.
 *
 * Uses IndexedDB. No singleton cache — fresh open per operation:
 * fake-indexeddb is in-memory, open() is cheap and correct under reset.
 *
 * Idempotency: dedup by compositeKey (`${orderId}|${idempotencyKey}`).
 *
 * Public API:
 *   enqueueOrder(order)     → Promise<number> (new queue depth)
 *   dequeueOrders()         → Promise<QueuedOrder[]>
 *   getPendingCount()       → Promise<number>
 *   clearQueue()            → Promise<void>
 *   registerBackgroundSync() → void
 *   _resetForTests()        → void  (internal test helper)
 */


// ── Types ──────────────────────────────────────────────────────────

export interface QueuedOrder {
  orderId: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  createdAt: number;
}

// ── Constants ──────────────────────────────────────────────────────

const DB_NAME = 'aura-offline-queue';
const STORE_NAME = 'pending_orders';
const DB_VERSION = 1;

// ── DB plumbing ────────────────────────────────────────────────────

function getIDB(): IDBFactory {
  const idb = (globalThis as Record<string, unknown>).indexedDB as IDBFactory | undefined;
  if (!idb) throw new Error('indexedDB not available');
  return idb;
}

function openDB(): Promise<IDBDatabase> {
  const idb = getIDB();
  return new Promise((resolve, reject) => {
    const req = idb.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'compositeKey' });
        store.createIndex('orderId', 'orderId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error(`IDB open failed: ${req.error}`));
  });
}

function unwrap(r: QueuedOrder & { compositeKey?: string }): QueuedOrder {
  const { compositeKey: _ck, ...rest } = r;
  return rest as QueuedOrder;
}

// ── Public API ─────────────────────────────────────────────────────

export async function enqueueOrder(order: QueuedOrder): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({
      ...order,
      compositeKey: `${order.orderId}|${order.idempotencyKey}`,
    });
    tx.oncomplete = () => resolve(getPendingCount());
    tx.onerror = () => reject(new Error(`IDB put failed: ${tx.error}`));
  });
}

export async function dequeueOrders(): Promise<QueuedOrder[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const allReq = store.getAll();
    allReq.onsuccess = () => {
      const all: QueuedOrder[] = allReq.result.map(unwrap);
      store.clear();
      tx.oncomplete = () => resolve(all);
    };
    allReq.onerror = () => reject(new Error(`IDB getAll failed: ${allReq.error}`));
  });
}

export async function getPendingCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME);
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error(`IDB count failed: ${req.error}`));
  });
}

export async function clearQueue(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error(`IDB clear failed: ${tx.error}`));
  });
}

export function registerBackgroundSync(): void {
  if (typeof navigator === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  const sw = (navigator.serviceWorker as ServiceWorkerContainer | undefined);
  if (!sw) return;
  if (!('SyncManager' in (window as unknown as Record<string, unknown>))) return;

  sw.ready
    .then((reg: ServiceWorkerRegistration) =>
      (reg as unknown as { sync: { register(tag: string): Promise<void> } }).sync.register('sync-pending-orders'))
    .catch(() => { /* fallback: retry on next app open */ });
}

// ── Internal test helper ────────────────────────────────────────────

export async function _resetForTests(): Promise<void> {
  const g = globalThis as Record<string, unknown>;
  const idb = g.indexedDB as IDBFactory | undefined;
  if (!idb) return;
  // Replace with a fresh factory so deleteDatabase clears all data.
  const mod = await import('fake-indexeddb');
  g.indexedDB = new mod.IDBFactory() as unknown as IDBFactory;
}
