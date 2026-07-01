import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

/* ═══════════════════════════════════════════════════════════════════
   useOrder — TanStack Query hook for GET /api/orders/:id.
   Used by OrderSuccess page to poll order status.
   ═══════════════════════════════════════════════════════════════════ */

export interface Order {
  id: string;
  status: string;
  total: number;
  payment_status: string;
  payment_method: string;
  customer_name: string;
  customer_phone: string;
  customer_address?: string;
  customer_email?: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    image?: string;
  }>;
  shipping_fee: number;
  discount: number;
  notes?: string;
  created_at: string;
  updated_at?: string;
  payment?: {
    id: string;
    method: string;
    amount: number;
    status: string;
  } | null;
}

interface OrderResponse {
  success: boolean;
  order: Order;
}

export function useOrder(orderId: string | null, options?: { refetchInterval?: number }) {
  return useQuery<OrderResponse>({
    queryKey: ['order', orderId],
    queryFn: () => apiFetch<OrderResponse>(`/api/orders/${orderId}`),
    enabled: !!orderId,
    refetchInterval: options?.refetchInterval ?? false,
  });
}
