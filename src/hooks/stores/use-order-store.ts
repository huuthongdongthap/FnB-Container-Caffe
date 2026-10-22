import { create, useStore } from 'zustand';
import { useEffect } from 'react';
import { apiFetch, API_BASE } from '@/lib/api-client';
import type { ApiFetchOptions } from '@/lib/api-client';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { offlineDb } from '@/lib/offline-db';
import { TERMINAL_STATUSES, POLL_INTERVAL } from './order-store-constants';
import { mapSseEventToOrder } from './order-store-utils';
import type { CustomerOrder, CreateOrderPayload, OrderState } from './order-store-types';
export type {
  OrderItem,
  Order,
  CreateOrderPayload,
  OrderState,
  CustomerOrder,
  CustomerOrderItem,
  OrderStatus,
  PaymentStatus,
  OrderChannel,
} from './order-store-types';
export { TERMINAL_STATUSES, POLL_INTERVAL } from './order-store-constants';
export { firstOrDefault, mapSseEventToOrder } from './order-store-utils';
export {
  toCustomerOrderViewModel,
  toCustomerOrderItemViewModel,
} from './order-store-mappers';
export type {
  CustomerOrderViewModel,
  CustomerOrderItemViewModel,
} from './order-store-mappers';

export const useOrderStore = create<OrderState>((set, get) => ({
  currentOrder: null, orderHistory: [], loading: false, error: null,
  pollingId: null, isPolling: false, eventSource: null, abortController: null, queuedOffline: false, flushInProgress: false,

  createOrder: async (payload, idempotencyKey) => {
    set({ loading: true, error: null });
    if (!navigator.onLine) {
      // Checkout cannot confirm a payment offline. Keep its existing intent key
      // for the next online retry instead of creating unkeyed queue duplicates.
      if (idempotencyKey) {
        set({ loading: false, error: 'Vui lòng kết nối mạng để xác nhận đơn hàng', queuedOffline: false });
        return null;
      }
      try { await offlineDb.saveOrder(payload); set({ loading: false, error: null, queuedOffline: true }); return null; }
      catch (err) { set({ loading: false, error: err instanceof Error ? err.message : 'Lỗi lưu tạm đơn' }); return null; }
    }
    try {
      const body = await apiFetch<any>('/api/orders', { method: 'POST', body: JSON.stringify(payload),
        ...(idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : {}) });
      const order: CustomerOrder = body.data;
      set({ currentOrder: order, loading: false, error: null, queuedOffline: false });
      return order;
    } catch (err) { set({ loading: false, error: err instanceof Error ? err.message : 'Lỗi kết nối' }); return null; }
  },

  fetchOrder: async (id) => {
    // Pin the poll this read belongs to. A response that arrives after the
    // subscription was torn down (or replaced) is stale and must be discarded —
    // writing it back would resurrect state the UI already left. Aborting the
    // signal is the first line of defence; this identity check covers the race
    // where the response lands before the abort is observed.
    const owner = get().abortController;
    const opts: ApiFetchOptions = owner && !owner.signal.aborted
      ? { signal: owner.signal }
      : {};
    set({ loading: true, error: null });
    try {
      let body: { data?: CustomerOrder } & Partial<CustomerOrder>;
      try {
        body = await apiFetch<{ data?: CustomerOrder } & Partial<CustomerOrder>>(`/api/orders/${encodeURIComponent(id)}`, opts);
      } catch {
        body = await apiFetch<{ data?: CustomerOrder } & Partial<CustomerOrder>>(`/api/orders/${encodeURIComponent(id)}/track`, opts);
      }
      // The abort lands on the signal before the store clears the reference, so
      // this one check covers both the abort and the resubscribe race.
      if (owner && owner.signal.aborted) { return; }
      const resolvedOrder = (body?.data ?? body) as CustomerOrder;
      if (resolvedOrder) {
        set({ currentOrder: resolvedOrder, loading: false, error: null });
        if (TERMINAL_STATUSES.includes(resolvedOrder.status)) { get().stopPolling(); }
      } else {
        set({ loading: false, error: null });
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') { return; }
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      set({ loading: false, error: message });
    }
  },

  startPolling: (id: string) => {
    const { isPolling, abortController, currentOrder } = get();
    if (isPolling) return;
    if (abortController?.signal.aborted) return;
    if (currentOrder && TERMINAL_STATUSES.includes(currentOrder.status)) return;

    set({ isPolling: true });
    const controller = new AbortController();
    set({ abortController: controller });

    const intervalId = window.setInterval(async () => {
      if (controller.signal.aborted) { get().stopPolling(); return; }
      const { currentOrder } = get();
      if (currentOrder && TERMINAL_STATUSES.includes(currentOrder.status)) { get().stopPolling(); return; }
      try { await get().fetchOrder(id); } catch { /* next interval */ }
    }, POLL_INTERVAL);

    set({ pollingId: intervalId });
  },

  stopPolling: () => {
    const { pollingId, abortController } = get();
    if (pollingId !== null) { window.clearInterval(pollingId); }
    abortController?.abort();
    set({ pollingId: null, isPolling: false, abortController: null });
  },

  subscribeToOrder: (id: string) => {
    get().unsubscribeFromOrder();
    const url = `${API_BASE}/api/orders/${encodeURIComponent(id)}/events`;
    const es = new EventSource(url, { withCredentials: true });
    es.addEventListener('update_order', (event: MessageEvent) => {
      try {
        const incoming = JSON.parse(event.data);
        const mapped = mapSseEventToOrder(incoming);
        set((state) => ({
          currentOrder: state.currentOrder
            ? { ...state.currentOrder, ...mapped, items: mapped.items?.length ? mapped.items : state.currentOrder.items }
            : mapped,
          error: null,
        }));
        // Terminal status reached via SSE — stop polling if it was started
        if (mapped && TERMINAL_STATUSES.includes(mapped.status)) { get().stopPolling(); }
      } catch { /* ignore */ }
    });
    const startPollingOnce = () => {
      const { isPolling, currentOrder } = get();
      // An order that already reached a terminal state has nothing left to poll
      // for — reconnecting the poller here would restart a fetch loop forever.
      if (isPolling) return;
      if (currentOrder && TERMINAL_STATUSES.includes(currentOrder.status)) return;
      get().startPolling(id);
    };
    es.addEventListener('timeout', () => { es.close(); set({ eventSource: null }); startPollingOnce(); });
    es.onerror = () => { es.close(); set({ eventSource: null }); startPollingOnce(); };
    set({ eventSource: es });
  },

  unsubscribeFromOrder: () => {
    const { eventSource } = get();
    if (eventSource) { eventSource.close(); set({ eventSource: null }); }
    get().stopPolling();
  },

  flushQueuedOrders: async () => {
    // A reconnect can fire the trigger twice, and both calls would walk the same
    // IndexedDB records and sync each one twice. The second caller sees the
    // flag and returns; the in-flight run owns the queue until it settles.
    if (get().flushInProgress) return null;
    set({ flushInProgress: true });
    try {
      const pending = await offlineDb.getPendingOrders();
      if (pending.length === 0) { set({ queuedOffline: false }); return null; }
      let lastOrder: CustomerOrder | null = null;
      let allSucceeded = true;
      for (const record of pending) {
        try {
          const body = await apiFetch<any>('/api/orders/sync', { method: 'POST', body: JSON.stringify(record) });
          lastOrder = body.data as CustomerOrder;
          set({ currentOrder: lastOrder, error: null });
          if (record.localId && typeof offlineDb.removeOrder === 'function') {
            try { await offlineDb.removeOrder(record.localId); } catch { /* ignore */ }
          }
        } catch {
          allSucceeded = false;
          set({ error: 'Lỗi kết nối khi gửi đơn hàng', loading: false });
          break;
        }
      }
      try {
        if (allSucceeded && lastOrder) {
          await offlineDb.clearOrders();
          set({ queuedOffline: false, loading: false });
        } else {
          set({ loading: false });
        }
      } catch { /* retry next reconnect */ }
      return lastOrder;
    } finally {
      set({ flushInProgress: false });
    }
  },
}));

/* ── Auto-flush queued orders when connection restores ───────────────── */
let lastOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

export function useOrderStoreWithOfflineFlush<T>(selector: (state: OrderState) => T): T;
export function useOrderStoreWithOfflineFlush(): OrderState;
export function useOrderStoreWithOfflineFlush<T>(selector?: (state: OrderState) => T): T | OrderState {
  const { isOnline, wasOffline } = useOnlineStatus();
  const flushQueuedOrders = useOrderStore((s) => s.flushQueuedOrders);
  const queuedOffline = useOrderStore((s) => s.queuedOffline);
  useEffect(() => {
    if (wasOffline && queuedOffline) void flushQueuedOrders();
    lastOnline = isOnline;
  }, [isOnline, wasOffline, queuedOffline, flushQueuedOrders]);
  return selector ? useStore(useOrderStore, selector) : useStore(useOrderStore);
}
