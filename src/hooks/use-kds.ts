import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

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
