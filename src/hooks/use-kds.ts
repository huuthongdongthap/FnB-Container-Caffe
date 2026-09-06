import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, API_BASE } from '@/lib/api-client';

export interface KDSOrder {
  id: string;
  table: string;
  status: 'pending' | 'preparing' | 'ready' | 'served';
  items: Array<{
    name: string;
    quantity: number;
    modifiers?: string[];
    notes?: string;
  }>;
  station?: string;
  createdAt: string;
}

/** Snapshot payload from GET /api/kds/orders/stream (D1-backed). */
interface KdsStreamOrder {
  id: string;
  customer_name: string;
  table_id: string | null;
  items: Array<{ product_name: string; product_id?: string; quantity: number; unit_price?: number; notes?: string }>;
  status: string;
  elapsed_minutes: number;
  created_at: string;
}

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

function mapStreamOrders(orders: KdsStreamOrder[]): KDSOrder[] {
  return orders.map((o) => ({
    id: o.id,
    table: o.table_id || '',
    status: o.status as KDSOrder['status'],
    items: (o.items || []).map((item) => ({
      name: item.product_name,
      quantity: item.quantity,
      notes: item.notes,
    })),
    createdAt: o.created_at,
  }));
}

export function useKDS(station: string = 'all'): KDSResult {
  const queryClient = useQueryClient();

  const {
    data = [],
    isLoading,
    isError,
    error,
  } = useQuery<KDSOrder[]>({
    queryKey: ['kds-orders', station],
    queryFn: () =>
      apiFetch<{ orders: KDSOrder[] }>(
        `/api/admin/orders?status=pending${station !== 'all' ? `&station=${station}` : ''}`
      ).then((res) => res.orders),
    refetchInterval: POLL_INTERVAL,
    retry: 3,
    staleTime: 4_000,
  });

  // Realtime push via SSE — replaces polling latency (~5s → ~3s worst case).
  // EventSource authenticates via the login session cookie; on error the
  // hook falls back to react-query polling above so KDS never goes blank.
  const esRef = useRef<EventSource | null>(null);
  useEffect(() => {
    if (station !== 'all') {
      return; // stream serves the combined queue; filtered views keep polling
    }
    const es = new EventSource(`${API_BASE}/api/kds/orders/stream`, { withCredentials: true });
    es.addEventListener('snapshot', (event: MessageEvent) => {
      try {
        const orders = mapStreamOrders(JSON.parse(event.data as string) as KdsStreamOrder[]);
        queryClient.setQueryData<KDSOrder[]>(['kds-orders', 'all'], orders);
      } catch { /* ignore malformed frame */ }
    });
    es.onerror = () => {
      // Keep EventSource's built-in reconnect; polling covers gaps.
    };
    esRef.current = es;
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [station, queryClient]);

  const completeMutation = useMutation({
    mutationFn: (orderId: string) =>
      apiFetch(`/api/admin/orders/${orderId}/complete`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-orders'] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: KDSOrder['status'] }) =>
      apiFetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-orders'] });
    },
  });

  return {
    orders: data,
    isLoading,
    isError,
    error: error as Error | null,
    completeOrder: (orderId: string) => completeMutation.mutate(orderId),
    updateStatus: (orderId: string, status: KDSOrder['status']) =>
      statusMutation.mutate({ orderId, status }),
    isCompleting: completeMutation.isPending,
  };
}
