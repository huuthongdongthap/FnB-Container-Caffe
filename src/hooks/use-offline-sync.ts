/* ═══════════════════════════════════════════════════════════════════
useOfflineSync — React hook wrapping OfflineDB for AURA Mobile
Queue mutations when offline, auto-sync on reconnect.
Conflict resolution: last-write-wins (server timestamp wins).
═══════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineDb, type OfflineOrderRecord } from '@/lib/offline-db';
import { API_BASE } from '@/lib/api-client';
import { isSameSessionSnapshot, readClientSession, readSessionSnapshot, subscribeSessionChange } from '@/lib/client-session';
import { logger } from '@/lib/logger';

const SYNC_INTERVAL_MS = 10_000; // poll every 10s when online

type QueuedItem = OfflineOrderRecord;

function resolveActiveOfflineContext(): { tenantId: string | null; userId: string | null } {
  const session = readClientSession();
  const user = session.user as { id?: string; tenantId?: string; tenant_id?: string } | null;
  const rawTenant = String(user?.tenantId || user?.tenant_id || '').trim();
  const tenantId = rawTenant || null;
  const userId = user?.id ? String(user.id).trim() : null;
  return { tenantId, userId };
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
  const syncingRef = useRef(false);

  /* ── Count pending ──────────────────────────────────────────── */
  const refreshPendingCount = useCallback(async () => {
    const pending = await offlineDb.getPendingOrders(resolveActiveOfflineContext());
    if (mountedRef.current) {
      setState(s => ({ ...s, pendingCount: pending.length }));
    }
    return pending;
  }, []);

  /* ── Sync a single item ─────────────────────────────────────── */
  const syncItem = useCallback(async (item: QueuedItem): Promise<boolean> => {
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('aura_auth_token') : null;
      const activeCtx = resolveActiveOfflineContext();
      const itemTenant = typeof item.tenantId === 'string' && item.tenantId.trim() ? item.tenantId.trim() : null;
      if (itemTenant && activeCtx.tenantId && itemTenant !== activeCtx.tenantId) {
        return false;
      }
      if (itemTenant && itemTenant !== 'default' && !activeCtx.tenantId) {
        return false;
      }
      if (item.userId && activeCtx.userId && item.userId !== activeCtx.userId) {
        return false;
      }
      if (item.userId && !activeCtx.userId) {
        return false;
      }
      const effectiveTenant = itemTenant || activeCtx.tenantId;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (effectiveTenant) headers['X-Tenant-ID'] = effectiveTenant;
      const res = await fetch(`${API_BASE}/api/orders/sync`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          localId: item.localId,
          orderData: item.orderData,
          createdAt: item.createdAt,
          ...(effectiveTenant ? { tenantId: effectiveTenant } : {}),
        }),
      });

      if (res.ok) {
        await offlineDb.removeOrder(item.localId);
        return true;
      }
      // 409 = conflict → server has newer version; keep local queue for manual resolve
      if (res.status === 409) {
        logger.warn('OfflineSync conflict — keeping in queue', { localId: item.localId });
        return false;
      }
      // Terminal validation errors (400/404/422) — drop from queue; auth/transient errors (401/403/408/429) remain queued
      if (
        res.status >= 400 &&
        res.status < 500 &&
        res.status !== 401 &&
        res.status !== 403 &&
        res.status !== 408 &&
        res.status !== 429
      ) {
        await offlineDb.removeOrder(item.localId);
        return true;
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

    const snap = readSessionSnapshot();
    try {
      const pending = await offlineDb.getPendingOrders(resolveActiveOfflineContext());
      let failed = 0;

      for (const item of pending) {
        if (!isSameSessionSnapshot(snap, readSessionSnapshot())) break;
        const ok = await syncItem(item as QueuedItem);
        if (!ok) failed++;
      }

      if (mountedRef.current && isSameSessionSnapshot(snap, readSessionSnapshot())) {
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
    const ctx = resolveActiveOfflineContext();
    const localId =
      ctx.tenantId || ctx.userId
        ? await offlineDb.saveOrder(orderData, ctx)
        : await offlineDb.saveOrder(orderData);
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
    const unsubscribeSession = subscribeSessionChange(() => {
      if (mountedRef.current) {
        setState(s => ({ ...s, syncing: false, error: null }));
        void refreshPendingCount();
      }
    });

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
      unsubscribeSession();
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
