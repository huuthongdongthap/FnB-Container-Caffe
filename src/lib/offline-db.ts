/* ═══════════════════════════════════════════════════════════════════
OfflineDB — plain IndexedDB wrapper for AURA CAFE offline queue.
No Dexie (YAGNI). Uses auradb / 'offlineOrders' object store
with keyPath 'localId' and a plain object for serialized order data.
═══════════════════════════════════════════════════════════════════ */

interface OfflineOrderRecord {
  localId: string;
  orderData: object;
  createdAt: number;
  synced: boolean;
  attemptCount?: number;
  lastAttemptAt?: number;
}

const DB_NAME = 'auradb';
const STORE_NAME = 'offlineOrders';

function openDB(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);

    request.onerror = () => reject(request.error ?? new Error('IDB open error'));
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'localId' });
      }
    };
  });
}

export class OfflineDB {
  /* Generate a time-ordered local id (nanoid-adjacent). */
  private static generateId(): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 10);
    return `local_${ts}_${rand}`;
  }

  /* Persist a serialized order payload. Returns the assigned localId. */
  async saveOrder(orderData: object): Promise<string> {
    const db = await openDB();
    const localId = OfflineDB.generateId();
    return new Promise<string>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).add({ localId, orderData, createdAt: Date.now(), synced: false });
      tx.oncomplete = () => resolve(localId);
      tx.onerror = () => reject(tx.error);
    });
  }

  /* Return every queued (not yet synced) order. */
  async getPendingOrders(): Promise<object[]> {
    const db = await openDB();
    return new Promise<object[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result.map((r: { orderData: object }) => r.orderData));
      req.onerror = () => reject(req.error);
    });
  }

  /* Remove a single order by localId after successful sync. */
  async removeOrder(localId: string): Promise<void> {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(localId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /* Mark order as synced (for partial sync). */
  async markSynced(localId: string): Promise<void> {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(localId);
      req.onsuccess = () => {
        const record = req.result;
        if (record) {
          record.synced = true;
          store.put(record);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /* ── Menu cache (single fixed entry keyed 'menu') ───────────────── */
  async saveMenuItems(items: unknown[]): Promise<void> {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ localId: 'menu', orderData: items });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getMenuItems(): Promise<unknown[]> {
    const db = await openDB();
    return new Promise<unknown[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get('menu');
      req.onsuccess = () => resolve((req.result?.orderData as unknown[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  }

  /* ── Menu categories cache (keyed '_meta_categories') ───────────── */
  async saveMenuCategories(categories: object): Promise<void> {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({
        localId: '_meta_categories',
        orderData: { items: categories, cachedAt: Date.now() },
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getMenuCategories(): Promise<{ items: unknown[]; cachedAt: number } | null> {
    const db = await openDB();
    return new Promise<{ items: unknown[]; cachedAt: number } | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get('_meta_categories');
      req.onsuccess = () => resolve((req.result?.orderData as { items: unknown[]; cachedAt: number } | null) ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  /* Purge the entire offline queue (e.g. after a successful full sync). */
  async clear(): Promise<void> {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const offlineDb = new OfflineDB();
