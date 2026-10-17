import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { OrderApiPayload } from '@/lib/validators';

/* ═══════════════════════════════════════════════════════════════════
   useCheckout — TanStack Query mutation for POST /api/orders.
   ═══════════════════════════════════════════════════════════════════ */

interface CreateOrderPayload extends OrderApiPayload {}

interface CreateOrderResponse {
  success: boolean;
  order_id?: string;
  data?: CreateOrderResponse['order'];
  order: {
    id: string;
    status: string;
    total: number;
    totalAmount?: number;
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
    mutationFn: async (payload) => {
      const res = await apiFetch<CreateOrderResponse>('/api/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.order && res.data) {
        return {
          ...res,
          order: {
            ...res.data,
            total: res.data.total ?? res.data.totalAmount ?? 0,
          },
        };
      }
      if (res.order && res.order.total === undefined && res.order.totalAmount !== undefined) {
        return {
          ...res,
          order: {
            ...res.order,
            total: res.order.totalAmount,
          },
        };
      }
      return res;
    },
  });
}

/* ═══════════════════════════════════════════════════════════════════
   useProcessPayOS — Called after successful order creation with PayOS.
   POST to get PayOS payment URL and redirect user.
   ═══════════════════════════════════════════════════════════════════ */

interface PayOSRequest {
  order_id: string;
  total: number;
  totalAmount?: number;
  cancel_url: string;
  return_url: string;
  description?: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
}

interface PayOSResponse {
  success: boolean;
  payment_url?: string;
  checkout_url?: string;
  checkoutUrl?: string;
  data?: { checkoutUrl?: string; checkout_url?: string; payment_url?: string };
  payment?: { checkoutUrl?: string };
  order_id?: string;
}

export function useProcessPayOS() {
  return useMutation<PayOSResponse, Error, PayOSRequest>({
    mutationFn: async (payload) => {
      const normalizedPayload = payload.total !== undefined
        ? payload
        : { ...payload, total: payload.totalAmount ?? 0 };
      const storedToken = typeof localStorage !== 'undefined'
        ? (localStorage.getItem('aura_auth_token') || localStorage.getItem('auth_token') || localStorage.getItem('token'))
        : null;
      const res = await apiFetch<PayOSResponse>('/api/payment/create-link', {
        method: 'POST',
        body: JSON.stringify(normalizedPayload),
        ...(storedToken ? { headers: { Authorization: `Bearer ${storedToken}` } } : {}),
      });
      const checkoutUrl =
        res.checkout_url
        || res.checkoutUrl
        || res.payment?.checkoutUrl
        || res.data?.checkoutUrl
        || res.data?.checkout_url
        || res.data?.payment_url;
      return {
        ...res,
        checkout_url: checkoutUrl,
        checkoutUrl,
      };
    },
  });
}
