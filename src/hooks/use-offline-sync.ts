/* ═══════════════════════════════════════════════════════════════════
useOfflineSync — React hook wrapping OfflineDB for AURA Mobile
Queue mutations when offline, auto-sync on reconnect.
Conflict resolution: last-write-wins (server timestamp wins).
═══════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineDb } from '@/lib/offline-db';
import { logger } from '@/lib/logger';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://aura-space-worker.agencyos-openclaw.workers.dev';
const SYNC_INTERVAL_MS = 10_000; // poll every 10s when online

interface QueuedItem {
  localId: string;
  orderData: object;
  createdAt: number;
  synced: boolean;
  attemptCount?: number;
}

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
      const res = await fetch(`${API_BASE}/api/orders/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    if (state.syncing || !state.isOnline) return;
    setState(s => ({ ...s, syncing: true, error: null }));

    const pending = await offlineDb.getPendingOrders();
    let synced = 0;
    let failed = 0;

    for (const item of pending) {
      const ok = await syncItem(item as QueuedItem);
      if (ok) synced++;
      else failed++;
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
  }, [state.syncing, state.isOnline, syncItem]);

  /* ── Queue a new mutation ───────────────────────────────────── */
  const queueMutation = useCallback(async (orderData: object): Promise<string> => {
    const localId = await offlineDb.saveOrder(orderData);
    await refreshPendingCount();
    // If online, try immediate sync
    if (state.isOnline && !state.syncing) {
      void syncAll();
    }
    return localId;
  }, [state.isOnline, state.syncing, refreshPendingCount, syncAll]);

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
