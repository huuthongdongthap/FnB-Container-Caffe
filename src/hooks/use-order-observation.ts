import { useEffect, useCallback } from 'react';
import {
  useOrderStoreWithOfflineFlush,
  type CustomerOrder,
} from '@/hooks/stores/use-order-store';
import {
  rememberGuestOrderToken,
  stripOrderTokenFromBrowserUrl,
} from '@/lib/guest-order-token';

const DEFAULT_OBSERVATION_TIMEOUT_MS = 10 * 60 * 1000;

export interface UseOrderObservationOptions {
  timeoutMs?: number;
  orderToken?: string | null;
}

export interface UseOrderObservationResult {
  currentOrder: CustomerOrder | null;
  matchedOrder: CustomerOrder | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Single lifecycle owner for observing a customer order by ID across
 * initial read, SSE stream, and fallback polling.
 */
export function useOrderObservation(
  orderId: string | null | undefined,
  options?: UseOrderObservationOptions,
): UseOrderObservationResult {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_OBSERVATION_TIMEOUT_MS;
  const explicitToken = options?.orderToken;
  const {
    currentOrder,
    loading,
    error,
    fetchOrder,
    subscribeToOrder,
    unsubscribeFromOrder,
  } = useOrderStoreWithOfflineFlush();

  useEffect(() => {
    if (!orderId) return;

    let urlToken = typeof explicitToken === 'string' && explicitToken.trim() ? explicitToken.trim() : '';
    if (!urlToken && typeof window !== 'undefined' && window.location?.search) {
      try {
        urlToken = new URLSearchParams(window.location.search).get('order_token')?.trim() || '';
      } catch {
        urlToken = '';
      }
    }
    if (urlToken) {
      rememberGuestOrderToken(orderId, urlToken);
      stripOrderTokenFromBrowserUrl();
    }

    subscribeToOrder(orderId);
    void fetchOrder(orderId);

    const timeout = setTimeout(() => {
      unsubscribeFromOrder();
    }, timeoutMs);

    return () => {
      clearTimeout(timeout);
      unsubscribeFromOrder();
    };
  }, [orderId, explicitToken, timeoutMs, fetchOrder, subscribeToOrder, unsubscribeFromOrder]);

  const refresh = useCallback(() => {
    if (!orderId) return;
    subscribeToOrder(orderId);
    void fetchOrder(orderId);
  }, [orderId, fetchOrder, subscribeToOrder]);

  const matchedOrder =
    orderId &&
    currentOrder &&
    (currentOrder.id === orderId || currentOrder.orderNumber === orderId)
      ? currentOrder
      : null;

  return {
    currentOrder,
    matchedOrder,
    loading,
    error,
    refresh,
  };
}
