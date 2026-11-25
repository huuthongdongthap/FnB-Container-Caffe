import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { useAuthStore } from './stores/use-auth-store';
import { normalizeKdsOrder, mapStreamOrders, type KDSOrder, type KdsStreamOrder } from './kds-order';
import { consumeKdsStream } from './kds-stream';
export type { KDSOrder } from './kds-order';

interface KDSResult {
  orders: KDSOrder[];
  shiftAvgPrepMinutes: number | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  completeOrder: (orderId: string) => void;
  updateStatus: (orderId: string, status: KDSOrder['status']) => void;
  markItemReady: (orderId: string, itemIndex: number) => void;
  recallOrder: (orderId: string, targetStatus?: 'preparing' | 'ready') => Promise<boolean>;
  isCompleting: boolean;
  pendingOrders: Record<string, boolean>;
  mutationErrors: Record<string, string>;
}

const FALLBACK_POLL_INTERVAL = 5_000;

export function notifyCrossScreenOrderSync(): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('aura:orders-changed'));
  }
}

export function useKDS(station: string = 'all'): KDSResult {
  const queryClient = useQueryClient();
  const user = useAuthStore(state => state.user);
  const sessionVersion = useAuthStore(state => state.sessionVersion);
  const identity = `${sessionVersion}:${user?.id ?? ''}:${user?.tenantId ?? 'default'}:${user?.role ?? ''}`;
  const queryKey = ['kds-orders', identity, station];
  const enabled = Boolean(user);
  const inFlight = useRef(new Set<string>());
  const [streamConnected, setStreamConnected] = useState(false);
  const [shiftAvgPrepMinutes, setShiftAvgPrepMinutes] = useState<number | null>(null);
  const [pendingOrders, setPendingOrders] = useState<Record<string, boolean>>({});
  const [mutationErrors, setMutationErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    inFlight.current.clear();
    setPendingOrders({});
    setMutationErrors({});
    setStreamConnected(false);
  }, [identity, station]);
  const { data = [], isLoading, isError, error, refetch } = useQuery<KDSOrder[]>({
    queryKey,
    enabled,
    queryFn: ({ signal }) => apiFetch<{
      orders?: Record<string, unknown>[];
      data?: Record<string, unknown>[];
      meta?: { avg_prep_minutes?: number | null };
    }>(
      `/api/kds/orders${station !== 'all' ? `?station=${encodeURIComponent(station)}` : ''}`, { signal },
    ).then(res => {
      if (res && typeof res === 'object' && res.meta && typeof res.meta.avg_prep_minutes === 'number') {
        setShiftAvgPrepMinutes(res.meta.avg_prep_minutes);
      }
      const list = Array.isArray(res?.orders) ? res.orders : Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      // The full active queue is authoritative, including removals made elsewhere.
      return list.map(normalizeKdsOrder);
    }),
    // Only run 5s REST polling when the SSE stream is disconnected so we never double-poll D1 every 3s+5s.
    refetchInterval: streamConnected ? false : FALLBACK_POLL_INTERVAL,
    retry: 1,
    staleTime: 4_000,
  });

  useEffect(() => {
    const controller = new AbortController();
    if (enabled) {
      void consumeKdsStream(
        controller.signal,
        payload => {
          if (!controller.signal.aborted) {
            queryClient.setQueryData<KDSOrder[]>(queryKey, mapStreamOrders(payload as KdsStreamOrder[]));
          }
        },
        station,
        connected => {
          if (!controller.signal.aborted) {
            setStreamConnected(connected);
          }
        },
      );
    }
    return () => {
      controller.abort();
      setStreamConnected(false);
      void queryClient.cancelQueries({ queryKey, exact: true });
      queryClient.removeQueries({ queryKey, exact: true });
    };
  // Identity includes actor, tenant and login generation; stale streams cannot cross sessions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, enabled, station, queryClient]);

  const statusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: KDSOrder['status'] }) =>
      apiFetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: async (_data, { orderId, status }) => {
      if (useAuthStore.getState().sessionVersion !== sessionVersion) return;
      const nowIso = new Date().toISOString();
      queryClient.setQueryData<KDSOrder[]>(queryKey, (prev = []) =>
        status === 'served'
          ? prev.filter((o) => o.id !== orderId)
          : prev.map((o) =>
              o.id === orderId
                ? {
                    ...o,
                    status,
                    updatedAt: nowIso,
                    ...(status === 'preparing' ? { startedAt: o.startedAt ?? nowIso } : {}),
                    ...(status === 'ready' ? { readyAt: o.readyAt ?? nowIso } : {}),
                  }
                : o,
            )
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['kds-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-orders'] }),
      ]);
      notifyCrossScreenOrderSync();
    },
    onError: (failure, { orderId }) => {
      if (useAuthStore.getState().sessionVersion !== sessionVersion) return;
      setMutationErrors(prev => ({ ...prev, [orderId]: failure.message }));
    },
    onSettled: (_data, _error, { orderId }) => {
      if (useAuthStore.getState().sessionVersion !== sessionVersion) return;
      inFlight.current.delete(orderId);
      setPendingOrders(prev => ({ ...prev, [orderId]: false }));
    },
  });

  const itemReadyMutation = useMutation({
    mutationFn: ({ orderId, itemIndex }: { orderId: string; itemIndex: number }) =>
      apiFetch<{ success: boolean; all_items_ready?: boolean; order_status?: KDSOrder['status'] }>(
        `/api/kds/orders/${encodeURIComponent(orderId)}/ready`,
        {
          method: 'POST',
          body: JSON.stringify({ itemIndex }),
        },
      ),
    onSuccess: async (res, { orderId, itemIndex }) => {
      if (useAuthStore.getState().sessionVersion !== sessionVersion) return;
      const nowIso = new Date().toISOString();
      queryClient.setQueryData<KDSOrder[]>(queryKey, (prev = []) =>
        prev.map((o) => {
          if (o.id !== orderId) return o;
          const nextItems = o.items.map((it, idx) =>
            idx === itemIndex ? { ...it, ready: true, status: 'ready', readyAt: it.readyAt ?? nowIso } : it,
          );
          const nextStatus = res?.order_status ?? (res?.all_items_ready ? 'ready' : o.status);
          return {
            ...o,
            items: nextItems,
            status: nextStatus,
            ...(nextStatus === 'ready' ? { readyAt: o.readyAt ?? nowIso } : {}),
          };
        }),
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['kds-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
      ]);
      notifyCrossScreenOrderSync();
    },
    onError: (failure, { orderId }) => {
      if (useAuthStore.getState().sessionVersion !== sessionVersion) return;
      setMutationErrors((prev) => ({ ...prev, [orderId]: failure.message }));
    },
  });

  const updateStatus = (orderId: string, status: KDSOrder['status']) => {
    if (!enabled || inFlight.current.has(orderId)) return;
    inFlight.current.add(orderId);
    setPendingOrders(prev => ({ ...prev, [orderId]: true }));
    setMutationErrors(prev => { const next = { ...prev }; delete next[orderId]; return next; });
    statusMutation.mutate({ orderId, status });
  };

  const markItemReady = (orderId: string, itemIndex: number) => {
    if (!enabled) return;
    itemReadyMutation.mutate({ orderId, itemIndex });
  };

  const recallOrder = async (orderId: string, targetStatus?: 'preparing' | 'ready'): Promise<boolean> => {
    if (!enabled) return false;
    try {
      await apiFetch(`/api/kds/orders/${encodeURIComponent(orderId)}/recall`, {
        method: 'POST',
        body: JSON.stringify(targetStatus ? { target_status: targetStatus } : {}),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['kds-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['kds-recent-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
      ]);
      notifyCrossScreenOrderSync();
      return true;
    } catch {
      return false;
    }
  };

  return {
    orders: enabled ? data : [],
    shiftAvgPrepMinutes,
    isLoading,
    isError,
    error: error as Error | null,
    refetch: () => {
      void refetch();
    },
    completeOrder: (orderId: string) => {
      const current = data.find(order => order.id === orderId);
      updateStatus(orderId, current?.status === 'pending' || current?.status === 'confirmed' ? 'preparing' : 'ready');
    },
    updateStatus,
    markItemReady,
    recallOrder,
    pendingOrders,
    mutationErrors,
    isCompleting: Object.values(pendingOrders).some(Boolean),
  };
}
