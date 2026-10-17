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

function normalizeModifiers(mods: unknown): string[] | undefined {
  if (!Array.isArray(mods)) return undefined;
  const names = mods
    .map((m) => (typeof m === 'string' ? m : String((m as { name?: unknown })?.name ?? '')))
    .filter(Boolean);
  return names.length > 0 ? names : undefined;
}

function mapStreamOrders(orders: KdsStreamOrder[]): KDSOrder[] {
  return orders.map((o) => ({
    id: o.id,
    table: o.table_id || '',
    status: o.status as KDSOrder['status'],
    items: (o.items || []).map((item) => {
      const rawItem = item as Record<string, unknown>;
      const modifiers = normalizeModifiers(rawItem.modifiers);
      return {
        name: String(item.product_name ?? rawItem.name ?? ''),
        quantity: Number(item.quantity ?? rawItem.qty ?? 1),
        ...(modifiers ? { modifiers } : {}),
        ...(item.notes || rawItem.note ? { notes: String(item.notes ?? rawItem.note) } : {}),
      };
    }),
    createdAt: o.created_at,
  }));
}

function normalizeKdsOrder(raw: Record<string, unknown>): KDSOrder {
  if (
    typeof raw.table === 'string' &&
    typeof raw.createdAt === 'string' &&
    Array.isArray(raw.items) &&
    raw.items.every(
      (i: unknown) =>
        typeof (i as { name?: unknown })?.name === 'string' &&
        typeof (i as { quantity?: unknown })?.quantity === 'number',
    )
  ) {
    return raw as unknown as KDSOrder;
  }

  let parsedItems: Array<Record<string, unknown>> = [];
  if (Array.isArray(raw.items)) {
    parsedItems = raw.items as Array<Record<string, unknown>>;
  } else if (typeof raw.items === 'string' && raw.items.trim()) {
    try {
      const parsed = JSON.parse(raw.items);
      if (Array.isArray(parsed)) parsedItems = parsed;
    } catch {
      parsedItems = [];
    }
  }

  return {
    id: String(raw.id ?? ''),
    table: String(raw.table ?? raw.table_number ?? raw.table_id ?? ''),
    status: (raw.status as KDSOrder['status']) || 'pending',
    items: parsedItems.map((item) => {
      const modifiers = normalizeModifiers(item.modifiers);
      return {
        name: String(item.name ?? item.product_name ?? ''),
        quantity: Number(item.quantity ?? item.qty ?? 1),
        ...(modifiers ? { modifiers } : {}),
        ...(item.notes || item.note ? { notes: String(item.notes ?? item.note) } : {}),
      };
    }),
    ...(typeof raw.station === 'string' ? { station: raw.station } : {}),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
  };
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
      apiFetch<{ orders?: Array<Record<string, unknown>>; data?: Array<Record<string, unknown>> }>(
        `/api/admin/orders?status=pending${station !== 'all' ? `&station=${station}` : ''}`
      ).then((res) => {
        const list = Array.isArray(res?.orders)
          ? res.orders
          : Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res)
              ? (res as Array<Record<string, unknown>>)
              : [];
        const fetched = list.map(normalizeKdsOrder);
        const existing = queryClient.getQueryData<KDSOrder[]>(['kds-orders', station]) ?? [];
        const fetchedIds = new Set(fetched.map((o) => o.id));
        const retainedActive = existing.filter(
          (o) =>
            !fetchedIds.has(o.id) &&
            (o.status === 'preparing' || o.status === 'ready') &&
            (station === 'all' || !o.station || o.station === station)
        );
        return [...fetched, ...retainedActive];
      }),
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
    mutationFn: async (orderId: string) => {
      try {
        return await apiFetch(`/api/admin/orders/${orderId}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'ready' }),
        });
      } catch {
        return apiFetch(`/api/admin/orders/${orderId}/complete`, { method: 'POST' });
      }
    },
    onSuccess: (_data, orderId) => {
      queryClient.setQueryData<KDSOrder[]>(['kds-orders', station], (prev = []) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'ready' } : o))
      );
      queryClient.invalidateQueries({ queryKey: ['kds-orders'] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: KDSOrder['status'] }) =>
      apiFetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_data, { orderId, status }) => {
      queryClient.setQueryData<KDSOrder[]>(['kds-orders', station], (prev = []) =>
        status === 'served'
          ? prev.filter((o) => o.id !== orderId)
          : prev.map((o) => (o.id === orderId ? { ...o, status } : o))
      );
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
