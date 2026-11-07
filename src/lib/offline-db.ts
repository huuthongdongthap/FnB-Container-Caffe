/* ═══════════════════════════════════════════════════════════════════
OfflineDB — plain IndexedDB wrapper for AURA CAFE offline queue.
No Dexie (YAGNI). Uses auradb / 'offlineOrders' object store
with keyPath 'localId' and a plain object for serialized order data.
═══════════════════════════════════════════════════════════════════ */

export interface OfflineOrderRecord {
  localId: string;
  orderData: object;
  createdAt: number;
  synced: boolean;
  tenantId?: string | null;
  userId?: string | null;
  attemptCount?: number;
  lastAttemptAt?: number;
  [key: string]: unknown;
}

const DB_NAME = 'auradb';
const STORE_NAME = 'offlineOrders';

function openDB(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
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

  /* Persist a serialized order payload bound to the active session/tenant. Returns the assigned localId. */
  async saveOrder(
    orderData: object,
    context?: { tenantId?: string | null; userId?: string | null }
  ): Promise<string> {
    const db = await openDB();
    const localId = OfflineDB.generateId();
    const rawOrder = orderData as {
      tenant_id?: string | null;
      tenantId?: string | null;
      customer_id?: string | null;
      userId?: string | null;
    };
    const tenantId = context?.tenantId ?? rawOrder?.tenantId ?? rawOrder?.tenant_id ?? null;
    const userId = context?.userId ?? rawOrder?.userId ?? rawOrder?.customer_id ?? null;
    return new Promise<string>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).add({
        localId,
        orderData,
        tenantId,
        userId,
        createdAt: Date.now(),
        synced: false,
      });
      tx.oncomplete = () => resolve(localId);
      tx.onerror = () => reject(tx.error);
    });
  }

  /* Return every queued (not yet synced) order matching the active session/tenant context. */
  async getPendingOrders(
    context?: { tenantId?: string | null; userId?: string | null }
  ): Promise<OfflineOrderRecord[]> {
    const db = await openDB();
    const preservedKeys = new Set(['menu', '_meta_categories']);
    const ctxTenant = context?.tenantId?.trim() || null;
    const ctxUser = context?.userId?.trim() || null;
    return new Promise<OfflineOrderRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        const records = (req.result as OfflineOrderRecord[])
          .filter(r => {
            if (
              preservedKeys.has(r.localId) ||
              r.localId?.startsWith('_') ||
              r.localId?.startsWith('menu:') ||
              r.synced
            ) {
              return false;
            }
            const recTenant = typeof r.tenantId === 'string' && r.tenantId.trim() ? r.tenantId.trim() : null;
            const recUser = typeof r.userId === 'string' && r.userId.trim() ? r.userId.trim() : null;
            if (ctxTenant) {
              if ((recTenant ?? 'default') !== ctxTenant) return false;
            } else if (recTenant && recTenant !== 'default') {
              return false;
            }
            if (ctxUser) {
              if (recUser && recUser !== ctxUser) return false;
            } else if (recUser) {
              return false;
            }
            return true;
          })
          .map(r => ({
            ...(typeof r.orderData === 'object' && r.orderData !== null ? r.orderData : {}),
            localId: r.localId,
            orderData: r.orderData,
            tenantId: r.tenantId ?? null,
            userId: r.userId ?? null,
            createdAt: r.createdAt,
            synced: r.synced,
          }));
        resolve(records);
      };
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

  /* ── Menu cache (tenant-keyed, defaulting to 'menu') ────────────── */
  async saveMenuItems(items: unknown[], tenantId = 'default'): Promise<void> {
    const db = await openDB();
    const normTenant = tenantId.trim() || 'default';
    const key = normTenant === 'default' ? 'menu' : `menu:${normTenant}`;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ localId: key, orderData: items, tenantId: normTenant });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getMenuItems(tenantId = 'default'): Promise<unknown[]> {
    const db = await openDB();
    const normTenant = tenantId.trim() || 'default';
    const key = normTenant === 'default' ? 'menu' : `menu:${normTenant}`;
    return new Promise<unknown[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve((req.result?.orderData as unknown[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  }

  /* ── Menu categories cache (tenant-keyed, defaulting to '_meta_categories') ── */
  async saveMenuCategories(categories: object, tenantId = 'default'): Promise<void> {
    const db = await openDB();
    const normTenant = tenantId.trim() || 'default';
    const key = normTenant === 'default' ? '_meta_categories' : `_meta_categories:${normTenant}`;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({
        localId: key,
        tenantId: normTenant,
        orderData: { items: categories, cachedAt: Date.now() },
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getMenuCategories(tenantId = 'default'): Promise<{ items: unknown[]; cachedAt: number } | null> {
    const db = await openDB();
    const normTenant = tenantId.trim() || 'default';
    const key = normTenant === 'default' ? '_meta_categories' : `_meta_categories:${normTenant}`;
    return new Promise<{ items: unknown[]; cachedAt: number } | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve((req.result?.orderData as { items: unknown[]; cachedAt: number } | null) ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  /* Remove only synced order records (preserves menu + category caches). */
  async clearOrders(): Promise<void> {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      const preservedKeys = new Set(['menu', '_meta_categories']);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        const key = String(cursor.primaryKey ?? '');
        const val = cursor.value as OfflineOrderRecord;
        if (!preservedKeys.has(key) && !key.startsWith('_') && !key.startsWith('menu:') && val?.synced === true) {
          store.delete(cursor.primaryKey);
        }
        cursor.continue();
      };
      tx.oncomplete = () => {
        try { db.close(); } catch {}
        resolve();
      };
      tx.onerror = () => {
        try { db.close(); } catch {}
        reject(tx.error);
      };
    });
  }

  /* Purge the entire offline queue including caches (e.g. for data reset). */
  async clear(): Promise<void> {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => {
        try { db.close(); } catch {}
        resolve();
      };
      tx.onerror = () => {
        try { db.close(); } catch {}
        reject(tx.error);
      };
    });
  }
}

export const offlineDb = new OfflineDB();
