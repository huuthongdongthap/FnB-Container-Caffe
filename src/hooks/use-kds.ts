import { useEffect } from 'react';
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
  completeOrder: (orderId: string) => void;
  updateStatus: (orderId: string, status: KDSOrder['status']) => void;
  isCompleting: boolean;
}

const POLL_INTERVAL = 5_000;

export function useKDS(station: string = 'all'): KDSResult {
  const queryClient = useQueryClient();
  const user = useAuthStore(state => state.user);
  const sessionVersion = useAuthStore(state => state.sessionVersion);
  const identity = `${sessionVersion}:${user?.id ?? ''}:${user?.tenantId ?? 'default'}:${user?.role ?? ''}`;
  const queryKey = ['kds-orders', identity, station];
  const enabled = Boolean(user);
  const { data = [], isLoading, isError, error } = useQuery<KDSOrder[]>({
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
    if (enabled && station === 'all') {
      void consumeKdsStream(controller.signal, payload => {
        if (!controller.signal.aborted) {
          queryClient.setQueryData(queryKey, mapStreamOrders(payload as KdsStreamOrder[]));
        }
      });
    }
    return () => {
      controller.abort();
      void queryClient.cancelQueries({ queryKey, exact: true });
      queryClient.removeQueries({ queryKey, exact: true });
    };
  // Identity includes actor, tenant and login generation; stale streams cannot cross sessions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, enabled, station, queryClient]);

  const completeMutation = useMutation({
    mutationFn: (orderId: string) => apiFetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH', body: JSON.stringify({ status: 'ready' }),
    }),
    onSuccess: (_data, orderId) => {
      if (useAuthStore.getState().sessionVersion !== sessionVersion) return;
      queryClient.setQueryData<KDSOrder[]>(queryKey, (prev = []) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'ready' } : o))
      );
      queryClient.invalidateQueries({ queryKey: ['kds-orders'] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: KDSOrder['status'] }) =>
      apiFetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_data, { orderId, status }) => {
      if (useAuthStore.getState().sessionVersion !== sessionVersion) return;
      queryClient.setQueryData<KDSOrder[]>(queryKey, (prev = []) =>
        status === 'served'
          ? prev.filter((o) => o.id !== orderId)
          : prev.map((o) => (o.id === orderId ? { ...o, status } : o))
      );
      queryClient.invalidateQueries({ queryKey: ['kds-orders'] });
    },
  });

  return {
    orders: enabled ? data : [],
    isLoading,
    isError,
    error: error as Error | null,
    completeOrder: (orderId: string) => completeMutation.mutate(orderId),
    updateStatus: (orderId: string, status: KDSOrder['status']) =>
      statusMutation.mutate({ orderId, status }),
    isCompleting: completeMutation.isPending,
  };
}
