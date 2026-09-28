import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { CustomerOrder } from './stores/order-store-types';
export type { CustomerOrder, CustomerOrderItem } from './stores/order-store-types';

/* ═══════════════════════════════════════════════════════════════════
   useOrder — TanStack Query hook for canonical GET /api/orders/:id.
   Used by OrderSuccess / TrackOrder pages to poll order status.
   Server projection returns `{ data: CustomerOrder }` (or `{ success: true, data: CustomerOrder }`).
   ═══════════════════════════════════════════════════════════════════ */

export interface OrderResponse {
  success?: boolean;
  data: CustomerOrder;
}

export function useOrder(orderId: string | null, options?: { refetchInterval?: number }) {
  return useQuery<OrderResponse>({
    queryKey: ['order', orderId],
    queryFn: () => apiFetch<OrderResponse>(`/api/orders/${orderId}`),
    enabled: !!orderId,
    refetchInterval: options?.refetchInterval ?? false,
  });
}
