import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { useAuthStore } from './stores/use-auth-store';
import { normalizeKdsOrder, mapStreamOrders, type KDSOrder, type KdsStreamOrder } from './kds-order';
import { consumeKdsStream } from './kds-stream';
export type { KDSOrder } from './kds-order';

interface KDSResult {
  orders: KDSOrder[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  completeOrder: (orderId: string) => void;
  updateStatus: (orderId: string, status: KDSOrder['status']) => void;
  isCompleting: boolean;
  pendingOrders: Record<string, boolean>;
  mutationErrors: Record<string, string>;
}

const POLL_INTERVAL = 5_000;

export function useKDS(station: string = 'all'): KDSResult {
  const queryClient = useQueryClient();
  const user = useAuthStore(state => state.user);
  const sessionVersion = useAuthStore(state => state.sessionVersion);
  const identity = `${sessionVersion}:${user?.id ?? ''}:${user?.tenantId ?? 'default'}:${user?.role ?? ''}`;
  const queryKey = ['kds-orders', identity, station];
  const enabled = Boolean(user);
  const inFlight = useRef(new Set<string>());
  const [pendingOrders, setPendingOrders] = useState<Record<string, boolean>>({});
  const [mutationErrors, setMutationErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    inFlight.current.clear();
    setPendingOrders({});
    setMutationErrors({});
  }, [identity, station]);
  const { data = [], isLoading, isError, error, refetch } = useQuery<KDSOrder[]>({
    queryKey,
    enabled,
    queryFn: ({ signal }) => apiFetch<{ orders?: Record<string, unknown>[]; data?: Record<string, unknown>[] }>(
      `/api/kds/orders${station !== 'all' ? `?station=${encodeURIComponent(station)}` : ''}`, { signal },
    ).then(res => {
      const list = Array.isArray(res?.orders) ? res.orders : Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      // The full active queue is authoritative, including removals made elsewhere.
      return list.map(normalizeKdsOrder);
    }),
    refetchInterval: POLL_INTERVAL,
    retry: 1,
    staleTime: 4_000,
  });

  useEffect(() => {
    const controller = new AbortController();
    if (enabled) {
      void consumeKdsStream(controller.signal, payload => {
        if (!controller.signal.aborted) {
          queryClient.setQueryData<KDSOrder[]>(queryKey, mapStreamOrders(payload as KdsStreamOrder[]));
        }
      }, station);
    }
    return () => {
      controller.abort();
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
      queryClient.setQueryData<KDSOrder[]>(queryKey, (prev = []) =>
        status === 'served'
          ? prev.filter((o) => o.id !== orderId)
          : prev.map((o) => (o.id === orderId ? { ...o, status } : o))
      );
      await queryClient.invalidateQueries({ queryKey: ['kds-orders'] });
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

  const updateStatus = (orderId: string, status: KDSOrder['status']) => {
    if (!enabled || inFlight.current.has(orderId)) return;
    inFlight.current.add(orderId);
    setPendingOrders(prev => ({ ...prev, [orderId]: true }));
    setMutationErrors(prev => { const next = { ...prev }; delete next[orderId]; return next; });
    statusMutation.mutate({ orderId, status });
  };

  return {
    orders: enabled ? data : [],
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
    pendingOrders,
    mutationErrors,
    isCompleting: Object.values(pendingOrders).some(Boolean),
  };
}
