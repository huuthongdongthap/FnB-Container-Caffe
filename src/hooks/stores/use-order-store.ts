import { create } from 'zustand';
import { useEffect } from 'react';
import { API_BASE } from '@/lib/api-client';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { offlineDb } from '@/lib/offline-db';
import { TERMINAL_STATUSES, POLL_INTERVAL } from './order-store-constants';
import { mapSseEventToOrder } from './order-store-utils';
import type { Order, CreateOrderPayload, OrderState } from './order-store-types';
export type { OrderItem, Order, CreateOrderPayload, OrderState } from './order-store-types';
export { TERMINAL_STATUSES, POLL_INTERVAL } from './order-store-constants';
export { firstOrDefault, mapSseEventToOrder } from './order-store-utils';

export const useOrderStore = create<OrderState>((set, get) => ({
  currentOrder: null, orderHistory: [], loading: false, error: null,
  pollingId: null, eventSource: null, queuedOffline: false,

  createOrder: async (payload) => {
    set({ loading: true, error: null });
    if (!navigator.onLine) {
      try { await offlineDb.saveOrder(payload); set({ loading: false, error: null, queuedOffline: true }); return null; }
      catch (err) { set({ loading: false, error: err instanceof Error ? err.message : 'Lỗi lưu tạm đơn' }); return null; }
    }
    try {
      const res = await fetch(`${API_BASE}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await res.json();
      if (!res.ok) { set({ loading: false, error: body.message || `Lỗi tạo đơn (${res.status})` }); return null; }
      const order: Order = body.data;
      set({ currentOrder: order, loading: false, error: null, queuedOffline: false });
      return order;
    } catch (err) { set({ loading: false, error: err instanceof Error ? err.message : 'Lỗi kết nối' }); return null; }
  },

  fetchOrder: async (id) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/orders/${id}`);
      if (res.status === 404) { set({ loading: false, error: 'Không tìm thấy đơn hàng' }); return; }
      const body = await res.json();
      if (!res.ok) { set({ loading: false, error: body.message || `Lỗi (${res.status})` }); return; }
      set({ currentOrder: body.data, loading: false, error: null });
    } catch (err) { set({ loading: false, error: err instanceof Error ? err.message : 'Lỗi kết nối' }); }
  },

  startPolling: (id: string) => {
    get().stopPolling();
    const intervalId = window.setInterval(async () => {
      const { currentOrder } = get();
      if (currentOrder && TERMINAL_STATUSES.includes(currentOrder.status)) { get().stopPolling(); return; }
      await get().fetchOrder(id);
    }, POLL_INTERVAL);
    set({ pollingId: intervalId });
  },

  stopPolling: () => {
    const { pollingId } = get();
    if (pollingId !== null) { window.clearInterval(pollingId); set({ pollingId: null }); }
  },

  subscribeToOrder: (id: string) => {
    get().unsubscribeFromOrder();
    const url = `${API_BASE}/api/orders/${id}/events`;
    const es = new EventSource(url);
    es.addEventListener('update_order', (event: MessageEvent) => {
      try { set({ currentOrder: mapSseEventToOrder(JSON.parse(event.data)), error: null }); } catch { /* ignore */ }
    });
    es.addEventListener('timeout', () => { es.close(); set({ eventSource: null }); get().startPolling(id); });
    es.onerror = () => { es.close(); set({ eventSource: null }); get().startPolling(id); };
    set({ eventSource: es });
  },

  unsubscribeFromOrder: () => {
    const { eventSource, pollingId } = get();
    if (eventSource) { eventSource.close(); set({ eventSource: null }); }
    if (pollingId !== null) { window.clearInterval(pollingId); set({ pollingId: null }); }
  },

  flushQueuedOrders: async () => {
    const pending = await offlineDb.getPendingOrders();
    if (pending.length === 0) { set({ queuedOffline: false }); return null; }
    let lastOrder: Order | null = null;
    for (const payload of pending as CreateOrderPayload[]) {
      try {
        const res = await fetch(`${API_BASE}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const body = await res.json();
        if (!res.ok) { set({ error: body.message || `Lỗi gửi đơn (${res.status})`, loading: false }); break; }
        lastOrder = body.data as Order; set({ currentOrder: lastOrder, error: null });
      } catch { set({ error: 'Lỗi kết nối khi gửi đơn hàng', loading: false }); break; }
    }
    try { if (lastOrder) await offlineDb.clear(); set({ queuedOffline: false, loading: false }); } catch { /* retry next reconnect */ }
    return lastOrder;
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
  const sel = selector ?? (() => useOrderStore.getState());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useOrderStore(sel as any);
}
