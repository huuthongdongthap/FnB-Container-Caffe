import { create, useStore } from 'zustand';
import { useEffect } from 'react';
import { apiFetch, API_BASE } from '@/lib/api-client';
import type { ApiFetchOptions } from '@/lib/api-client';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { offlineDb } from '@/lib/offline-db';
import {
  readClientSession,
  readSessionSnapshot,
  isSameSessionSnapshot,
  subscribeSessionChange,
} from '@/lib/client-session';
import { TERMINAL_STATUSES, POLL_INTERVAL } from './order-store-constants';
import { mapSseEventToOrder } from './order-store-utils';
import type { CustomerOrder, CreateOrderPayload as _CreateOrderPayload, OrderState } from './order-store-types';
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
  pollingId: null, isPolling: false, eventSource: null, abortController: null, observedOrderId: null, queuedOffline: false, flushInProgress: false,

  createOrder: async (payload, idempotencyKey) => {
    const sessionSnap = readSessionSnapshot();
    set({ loading: true, error: null });
    if (!navigator.onLine) {
      // Checkout cannot confirm a payment offline. Keep its existing intent key
      // for the next online retry instead of creating unkeyed queue duplicates.
      if (idempotencyKey) {
        set({ loading: false, error: 'Vui lòng kết nối mạng để xác nhận đơn hàng', queuedOffline: false });
        return null;
      }
      try {
        const sessionUser = readClientSession().user;
        await offlineDb.saveOrder(payload, {
          tenantId: sessionUser?.tenantId ?? null,
          userId: sessionUser?.id ?? null,
        });
        if (!isSameSessionSnapshot(sessionSnap, readSessionSnapshot())) {
          set({ loading: false });
          return null;
        }
        set({ loading: false, error: null, queuedOffline: true });
        return null;
      }
      catch (err) { set({ loading: false, error: err instanceof Error ? err.message : 'Lỗi lưu tạm đơn' }); return null; }
    }
    try {
      const body = await apiFetch<any>('/api/orders', { method: 'POST', body: JSON.stringify(payload),
        ...(idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : {}) });
      if (!isSameSessionSnapshot(sessionSnap, readSessionSnapshot())) {
        set({ loading: false });
        return null;
      }
      const order: CustomerOrder = body.data ?? body;
      set({ currentOrder: order, loading: false, error: null, queuedOffline: false });
      return order;
    } catch (err) {
      if (!isSameSessionSnapshot(sessionSnap, readSessionSnapshot())) {
        set({ loading: false });
        return null;
      }
      set({ loading: false, error: err instanceof Error ? err.message : 'Lỗi kết nối' });
      return null;
    }
  },

  fetchOrder: async (id) => {
    const sessionSnap = readSessionSnapshot();
    const previousObservedId = get().observedOrderId;
    if (previousObservedId && previousObservedId !== id) {
      get().abortController?.abort();
    }
    let owner = get().abortController;
    if (!owner || owner.signal.aborted || (previousObservedId && previousObservedId !== id)) {
      owner = new AbortController();
      set({ abortController: owner, observedOrderId: id });
    } else if (get().observedOrderId !== id) {
      set({ observedOrderId: id });
    }
    const opts: ApiFetchOptions = { signal: owner.signal };
    set({ loading: true, error: null });
    try {
      let body: { data?: CustomerOrder } & Partial<CustomerOrder>;
      try {
        body = await apiFetch<{ data?: CustomerOrder } & Partial<CustomerOrder>>(`/api/orders/${encodeURIComponent(id)}`, opts);
      } catch (primaryErr) {
        if (owner.signal.aborted || (primaryErr instanceof Error && primaryErr.name === 'AbortError')) {
          return;
        }
        body = await apiFetch<{ data?: CustomerOrder } & Partial<CustomerOrder>>(`/api/orders/${encodeURIComponent(id)}/track`, opts);
      }
      if (owner.signal.aborted || !isSameSessionSnapshot(sessionSnap, readSessionSnapshot())) { return; }
      const activeObservedId = get().observedOrderId;
      if (activeObservedId && activeObservedId !== id) { return; }
      const resolvedOrder = (body?.data ?? body) as CustomerOrder;
      if (resolvedOrder) {
        set({ currentOrder: resolvedOrder, loading: false, error: null });
        if (TERMINAL_STATUSES.includes(resolvedOrder.status)) { get().stopPolling(); }
      } else {
        set({ loading: false, error: null });
      }
    } catch (err) {
      if (owner.signal.aborted || (err instanceof Error && err.name === 'AbortError')) { return; }
      if (!isSameSessionSnapshot(sessionSnap, readSessionSnapshot())) { return; }
      const activeObservedId = get().observedOrderId;
      if (activeObservedId && activeObservedId !== id) { return; }
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      set({ loading: false, error: message });
    }
  },

  startPolling: (id: string) => {
    const { isPolling, abortController, currentOrder, observedOrderId } = get();
    if (isPolling) return;
    if (abortController?.signal.aborted) return;
    if (currentOrder && TERMINAL_STATUSES.includes(currentOrder.status)) return;

    const controller =
      abortController && !abortController.signal.aborted && (!observedOrderId || observedOrderId === id)
        ? abortController
        : new AbortController();
    set({ isPolling: true, abortController: controller, observedOrderId: id });

    const intervalId = window.setInterval(async () => {
      if (controller.signal.aborted) { get().stopPolling(); return; }
      const { currentOrder: latestOrder, observedOrderId: latestObservedId } = get();
      if (latestObservedId && latestObservedId !== id) { get().stopPolling(); return; }
      if (latestOrder && TERMINAL_STATUSES.includes(latestOrder.status)) { get().stopPolling(); return; }
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
    const sessionSnap = readSessionSnapshot();
    const { eventSource: prevEs, pollingId: prevPollingId, abortController: prevController, observedOrderId: prevObservedId, currentOrder: prevOrder } = get();
    if (prevEs) { prevEs.close(); }
    if (prevPollingId !== null) { window.clearInterval(prevPollingId); }
    const isSameOrderInFlight = prevObservedId === id && prevController && !prevController.signal.aborted;
    if (!isSameOrderInFlight) {
      prevController?.abort();
    }
    const controller = isSameOrderInFlight ? prevController : new AbortController();
    const shouldClearStaleOrder = Boolean(
      prevOrder && prevOrder.id !== id && prevOrder.orderNumber !== id,
    );
    set({
      eventSource: null,
      pollingId: null,
      isPolling: false,
      abortController: controller,
      observedOrderId: id,
      ...(shouldClearStaleOrder ? { currentOrder: null } : {}),
    });

    const url = `${API_BASE}/api/orders/${encodeURIComponent(id)}/events`;
    const es = new EventSource(url, { withCredentials: true });
    es.addEventListener('update_order', (event: MessageEvent) => {
      if (controller.signal.aborted || get().observedOrderId !== id) return;
      if (!isSameSessionSnapshot(sessionSnap, readSessionSnapshot())) {
        get().unsubscribeFromOrder();
        return;
      }
      try {
        const incoming = JSON.parse(event.data);
        if (
          incoming &&
          typeof incoming === 'object' &&
          'id' in incoming &&
          incoming.id &&
          String(incoming.id) !== String(id) &&
          String((incoming as { orderNumber?: unknown }).orderNumber ?? '') !== String(id)
        ) {
          return;
        }
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
      if (controller.signal.aborted || get().observedOrderId !== id) return;
      if (!isSameSessionSnapshot(sessionSnap, readSessionSnapshot())) return;
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
    set({ observedOrderId: null });
  },

  flushQueuedOrders: async () => {
    // A reconnect can fire the trigger twice, and both calls would walk the same
    // IndexedDB records and sync each one twice. The second caller sees the
    // flag and returns; the in-flight run owns the queue until it settles.
    if (get().flushInProgress) return null;
    const sessionSnap = readSessionSnapshot();
    set({ flushInProgress: true });
    try {
      const sessionUser = readClientSession().user;
      const pending = await offlineDb.getPendingOrders({
        tenantId: sessionUser?.tenantId ?? null,
        userId: sessionUser?.id ?? null,
      });
      if (pending.length === 0) { set({ queuedOffline: false }); return null; }
      let lastOrder: CustomerOrder | null = null;
      let allSucceeded = true;
      for (const record of pending) {
        if (!isSameSessionSnapshot(sessionSnap, readSessionSnapshot())) {
          return null;
        }
        try {
          const body = await apiFetch<any>('/api/orders/sync', { method: 'POST', body: JSON.stringify(record) });
          if (!isSameSessionSnapshot(sessionSnap, readSessionSnapshot())) {
            return null;
          }
          lastOrder = body.data as CustomerOrder;
          set({ currentOrder: lastOrder, error: null });
          if (record.localId && typeof offlineDb.removeOrder === 'function') {
            try { await offlineDb.removeOrder(record.localId); } catch { /* ignore */ }
          }
        } catch {
          allSucceeded = false;
          if (isSameSessionSnapshot(sessionSnap, readSessionSnapshot())) {
            set({ error: 'Lỗi kết nối khi gửi đơn hàng', loading: false });
          }
          break;
        }
      }
      if (!isSameSessionSnapshot(sessionSnap, readSessionSnapshot())) {
        return null;
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

// Tear down active order streams/polling and clear order state whenever the
// authenticated user or tenant scope changes.
if (typeof window !== 'undefined') {
  subscribeSessionChange(() => {
    useOrderStore.getState().unsubscribeFromOrder();
    useOrderStore.setState({
      currentOrder: null,
      orderHistory: [],
      loading: false,
      error: null,
      queuedOffline: false,
    });
  });
}

/* ── Auto-flush queued orders when connection restores ───────────────── */
export function useOrderStoreWithOfflineFlush<T>(selector: (state: OrderState) => T): T;
export function useOrderStoreWithOfflineFlush(): OrderState;
export function useOrderStoreWithOfflineFlush<T>(selector?: (state: OrderState) => T): T | OrderState {
  const { isOnline, wasOffline } = useOnlineStatus();
  const flushQueuedOrders = useOrderStore((s) => s.flushQueuedOrders);
  const queuedOffline = useOrderStore((s) => s.queuedOffline);
  useEffect(() => {
    if (wasOffline && queuedOffline) void flushQueuedOrders();
  }, [isOnline, wasOffline, queuedOffline, flushQueuedOrders]);
  return selector ? useStore(useOrderStore, selector) : useStore(useOrderStore);
}
