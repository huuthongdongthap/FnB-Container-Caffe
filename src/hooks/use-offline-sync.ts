/* ═══════════════════════════════════════════════════════════════════
useOfflineSync — React hook wrapping OfflineDB for AURA Mobile
Queue mutations when offline, auto-sync on reconnect.
Conflict resolution: last-write-wins (server timestamp wins).
═══════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineDb, type OfflineOrderRecord } from '@/lib/offline-db';
import { API_BASE } from '@/lib/api-client';
import { captureGuestOrderTokenFromResponse } from '@/lib/guest-order-token';
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
  /** Orders rejected by server validation, kept locally for staff review. */
  quarantinedCount: number;
  syncing: boolean;
  lastSyncAt: number | null;
  error: string | null;
}

/* ── Hook ─────────────────────────────────────────────────────────── */

export function useOfflineSync() {
  const [state, setState] = useState<SyncState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendingCount: 0,
    quarantinedCount: 0,
    syncing: false,
    lastSyncAt: null,
    error: null,
  });

  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const syncingRef = useRef(false);

  /* ── Count pending ──────────────────────────────────────────── */
  const refreshPendingCount = useCallback(async () => {
    const ctx = resolveActiveOfflineContext();
    const pending = await offlineDb.getPendingOrders(ctx);
    const quarantined = await offlineDb.countNeedsAttention(ctx).catch(() => 0);
    if (mountedRef.current) {
      setState(s => ({ ...s, pendingCount: pending.length, quarantinedCount: quarantined }));
    }
    return pending;
  }, []);

  /* ── Sync a single item ─────────────────────────────────────── */
  const syncItem = useCallback(async (item: QueuedItem): Promise<boolean> => {
    try {
      const sessionToken = readClientSession().token;
      const token =
        sessionToken ||
        (typeof localStorage !== 'undefined'
          ? localStorage.getItem('aura_auth_token') || localStorage.getItem('mobile_token')
          : null);
      const activeCtx = resolveActiveOfflineContext();
      const itemTenant = typeof item.tenantId === 'string' && item.tenantId.trim() ? item.tenantId.trim() : null;
      if (itemTenant && activeCtx.tenantId && itemTenant !== activeCtx.tenantId) {
        return false;
      }
      if (itemTenant && itemTenant !== 'default' && !activeCtx.tenantId) {
        return false;
      }
      const itemUser = typeof item.userId === 'string' && item.userId.trim() ? item.userId.trim() : null;
      if (itemUser !== activeCtx.userId) {
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
        if (typeof res.json === 'function') {
          try {
            captureGuestOrderTokenFromResponse(await res.json());
          } catch {
            // Non-JSON sync response is non-fatal
          }
        }
        await offlineDb.removeOrder(item.localId);
        return true;
      }
      // 409 = conflict → server has newer version; keep local queue for manual resolve
      if (res.status === 409) {
        logger.warn('OfflineSync conflict — keeping in queue', { localId: item.localId });
        return false;
      }
      // Terminal validation errors (400/404/422) — quarantine as needs_attention instead of deleting POS data
      if (
        res.status >= 400 &&
        res.status < 500 &&
        res.status !== 401 &&
        res.status !== 403 &&
        res.status !== 408 &&
        res.status !== 429
      ) {
        if (typeof offlineDb.markNeedsAttention === 'function') {
          await offlineDb.markNeedsAttention(item.localId, `HTTP ${res.status}`);
        }
        logger.warn('OfflineSync validation rejected — marked needs_attention', {
          localId: item.localId,
          status: res.status,
        });
        return false;
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
    const acquiredSharedLock =
      typeof offlineDb.tryAcquireSyncLock === 'function'
        ? offlineDb.tryAcquireSyncLock()
        : true;
    if (!acquiredSharedLock) return;
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
        const currentCtx = resolveActiveOfflineContext();
        let remainingPending = failed;
        let nextQuarantined = 0;
        try {
          const remaining = await offlineDb.getPendingOrders(currentCtx);
          remainingPending = remaining.length;
          if (typeof offlineDb.countNeedsAttention === 'function') {
            nextQuarantined = await offlineDb.countNeedsAttention(currentCtx);
          }
        } catch {
          // Retain fallback counts when IndexedDB read fails
        }
        if (mountedRef.current && isSameSessionSnapshot(snap, readSessionSnapshot())) {
          setState(s => ({
            ...s,
            syncing: false,
            pendingCount: remainingPending,
            quarantinedCount: nextQuarantined,
            lastSyncAt: Date.now(),
            error: remainingPending > 0 ? `${remainingPending} orders chưa đồng bộ (có thể do offline)` : null,
          }));
        }
      }
    } finally {
      if (typeof offlineDb.releaseSyncLock === 'function') {
        offlineDb.releaseSyncLock();
      }
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
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if ((event.data as { type?: string } | null)?.type === 'FLUSH_OFFLINE_ORDERS') {
        void syncAll();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    navigator.serviceWorker?.addEventListener?.('message', handleServiceWorkerMessage);
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
      navigator.serviceWorker?.removeEventListener?.('message', handleServiceWorkerMessage);
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
