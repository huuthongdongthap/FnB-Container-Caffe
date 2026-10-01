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
  /** PayOS checkout URL (alternative to payment_url) */
  checkout_url?: string;
  /** Error message when success is false */
  message?: string;
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
  checkoutUrl?: string;
  payment?: { checkoutUrl?: string };
  order_id?: string;
}

export function useProcessPayOS() {
  return useMutation<PayOSResponse, Error, PayOSRequest>({
    mutationFn: async (payload) => {
      const res = await apiFetch<PayOSResponse>('/api/payment/create-link', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const checkoutUrl = res.checkout_url || res.checkoutUrl || res.payment?.checkoutUrl;
      return {
        ...res,
        checkout_url: checkoutUrl,
        checkoutUrl,
      };
    },
  });
}
