import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { OrderApiPayload } from '@/lib/validators';

/* ═══════════════════════════════════════════════════════════════════
   useCheckout — TanStack Query mutation for POST /api/orders.
   ═══════════════════════════════════════════════════════════════════ */

interface CreateOrderPayload extends OrderApiPayload {}

interface CreateOrderResponse {
  success: boolean;
  order: {
    id: string;
    status: string;
    total: number;
    payment_method: string;
    payment_status: string;
    customer_name: string;
    customer_phone: string;
    customer_address?: string;
    items: Array<{
      id: string;
      name: string;
      price: number;
      quantity: number;
    }>;
    created_at: string;
  };
  payment_url?: string;
}

export function useCheckout() {
  return useMutation<CreateOrderResponse, Error, CreateOrderPayload>({
    mutationFn: (payload) =>
      apiFetch<CreateOrderResponse>('/api/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  });
}

/* ═══════════════════════════════════════════════════════════════════
   useProcessPayOS — Called after successful order creation with PayOS.
   POST to get PayOS payment URL and redirect user.
   ═══════════════════════════════════════════════════════════════════ */

interface PayOSRequest {
  order_id: string;
  total: number;
  cancel_url: string;
  return_url: string;
  description?: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
}

interface PayOSResponse {
  success: boolean;
  checkout_url?: string;
  payment?: { checkoutUrl?: string };
  order_id?: string;
}

export function useProcessPayOS() {
  return useMutation<PayOSResponse, Error, PayOSRequest>({
    mutationFn: (payload) =>
      apiFetch<PayOSResponse>('/api/payment/payos/create', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  });
}
