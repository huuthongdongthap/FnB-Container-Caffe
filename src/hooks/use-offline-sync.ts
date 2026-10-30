/* ═══════════════════════════════════════════════════════════════════
useOfflineSync — React hook wrapping OfflineDB for AURA Mobile
Queue mutations when offline, auto-sync on reconnect.
Conflict resolution: last-write-wins (server timestamp wins).
═══════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineDb, type OfflineOrderRecord } from '@/lib/offline-db';
import { API_BASE } from '@/lib/api-client';
import { logger } from '@/lib/logger';

const SYNC_INTERVAL_MS = 10_000; // poll every 10s when online

type QueuedItem = OfflineOrderRecord;

interface SyncState {
  isOnline: boolean;
  pendingCount: number;
  syncing: boolean;
  lastSyncAt: number | null;
  error: string | null;
}

/* ── Hook ─────────────────────────────────────────────────────────── */

export function useOfflineSync() {
  const [state, setState] = useState<SyncState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendingCount: 0,
    syncing: false,
    lastSyncAt: null,
    error: null,
  });

  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const syncingRef = useRef(false);

  /* ── Count pending ──────────────────────────────────────────── */
  const refreshPendingCount = useCallback(async () => {
    const pending = await offlineDb.getPendingOrders();
    if (mountedRef.current) {
      setState(s => ({ ...s, pendingCount: pending.length }));
    }
    return pending;
  }, []);

  /* ── Sync a single item ─────────────────────────────────────── */
  const syncItem = useCallback(async (item: QueuedItem): Promise<boolean> => {
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('aura_auth_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/orders/sync`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          localId: item.localId,
          orderData: item.orderData,
          createdAt: item.createdAt,
        }),
      });

      if (res.ok) {
        await offlineDb.removeOrder(item.localId);
        return true;
      }
      // 409 = conflict → server has newer version; keep local queue for manual resolve
      if (res.status === 409) {
        logger.warn('OfflineSync conflict — keeping in queue', { localId: item.localId });
      }
      return false;
    } catch {
      // Network error — keep in queue
      return false;
    }
  }, []);

  /* ── Flush entire queue ─────────────────────────────────────── */
  const syncAll = useCallback(async () => {
    const currentlyOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (syncingRef.current || !currentlyOnline) return;
    syncingRef.current = true;
    setState(s => ({ ...s, syncing: true, error: null }));

    try {
      const pending = await offlineDb.getPendingOrders();
      let failed = 0;

      for (const item of pending) {
        const ok = await syncItem(item as QueuedItem);
        if (!ok) failed++;
      }

      if (mountedRef.current) {
        setState(s => ({
          ...s,
          syncing: false,
          pendingCount: failed,
          lastSyncAt: Date.now(),
          error: failed > 0 ? `${failed} orders chưa đồng bộ (có thể do offline)` : null,
        }));
      }
    } finally {
      syncingRef.current = false;
    }
  }, [syncItem]);

  /* ── Queue a new mutation ───────────────────────────────────── */
  const queueMutation = useCallback(async (orderData: object): Promise<string> => {
    const localId = await offlineDb.saveOrder(orderData);
    await refreshPendingCount();
    // If online, try immediate sync
    const currentlyOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (currentlyOnline && !syncingRef.current) {
      void syncAll();
    }
    return localId;
  }, [refreshPendingCount, syncAll]);

  /* ── Online/offline listeners ───────────────────────────────── */
  useEffect(() => {
    mountedRef.current = true;

    const handleOnline = () => {
      setState(s => ({ ...s, isOnline: true }));
      void syncAll(); // auto-sync on reconnect
    };
    const handleOffline = () => {
      setState(s => ({ ...s, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial count
    void refreshPendingCount();

    // Periodic sync while online
    syncTimerRef.current = setInterval(() => {
      if (navigator.onLine) {
        void syncAll();
      }
    }, SYNC_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
  }, [refreshPendingCount, syncAll]);

  return {
    ...state,
    queueMutation,
    syncAll,
    refreshPendingCount,
  };
}
