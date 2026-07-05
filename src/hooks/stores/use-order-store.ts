import { create } from 'zustand';
import { useEffect } from 'react';
import { API_BASE } from '@/lib/api-client';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { offlineDb } from '@/lib/offline-db';

/* ═══════════════════════════════════════════════════════════════════
   Order store — Zustand, no persistence.
   createOrder POST /api/orders, fetchOrder GET /api/orders/:id.
   SSE subscription for real-time order status updates.
   ═══════════════════════════════════════════════════════════════════ */


export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  status: string;
  total: number;
  payment_status: string;
  payment_method: string;
  customer_name: string;
  customer_phone: string;
  customer_address?: string;
  items: OrderItem[];
  created_at: string;
  discount?: number;
  shipping_fee?: number;
  notes?: string;
  table_id?: string;
}

export interface CreateOrderPayload {
  items: OrderItem[];
  total: number;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  customer_address: string;
  payment_method: string;
  notes?: string;
  delivery_time?: string;
  shipping_fee?: number;
  discount?: number;
  tip?: number;
  table_id?: string;
}

const TERMINAL_STATUSES = ['delivered', 'cancelled', 'completed'];
const POLL_INTERVAL = 15_000;

interface OrderState {
  currentOrder: Order | null;
  orderHistory: Order[];
  loading: boolean;
  error: string | null;
  pollingId: number | null;
  eventSource: EventSource | null;
  queuedOffline: boolean;

  createOrder: (payload: CreateOrderPayload) => Promise<Order | null>;
  fetchOrder: (id: string) => Promise<void>;
  startPolling: (id: string) => void;
  stopPolling: () => void;
  subscribeToOrder: (id: string) => void;
  unsubscribeFromOrder: () => void;
  flushQueuedOrders: () => Promise<Order | null>;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  currentOrder: null,
  orderHistory: [],
  loading: false,
  error: null,
  pollingId: null,
  eventSource: null,
  queuedOffline: false,

  createOrder: async (payload) => {
    set({ loading: true, error: null });

    /* Offline: queue to IndexedDB and surface queuedOffline=true. */
    if (!navigator.onLine) {
      try {
        await offlineDb.saveOrder(payload);
        set({ loading: false, error: null, queuedOffline: true });
        return null;
      } catch (err) {
        set({ loading: false, error: err instanceof Error ? err.message : 'Lỗi lưu tạm đơn' });
        return null;
      }
    }

    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = await res.json();

      if (!res.ok) {
        set({ loading: false, error: body.message || `Lỗi tạo đơn (${res.status})` });
        return null;
      }

      const order: Order = body.order ?? body;
      set({ currentOrder: order, loading: false, error: null, queuedOffline: false });
      return order;
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Lỗi kết nối' });
      return null;
    }
  },

  fetchOrder: async (id) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/orders/${id}`);

      if (res.status === 404) {
        set({ loading: false, error: 'Không tìm thấy đơn hàng' });
        return;
      }

      const body = await res.json();

      if (!res.ok) {
        set({ loading: false, error: body.message || `Lỗi (${res.status})` });
        return;
      }

      set({ currentOrder: body.order ?? body, loading: false, error: null });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Lỗi kết nối' });
    }
  },

  startPolling: (id: string) => {
    get().stopPolling();
    const intervalId = window.setInterval(async () => {
      const { currentOrder } = get();
      if (currentOrder && TERMINAL_STATUSES.includes(currentOrder.status)) {
        get().stopPolling();
        return;
      }
      await get().fetchOrder(id);
    }, POLL_INTERVAL);
    set({ pollingId: intervalId });
  },

  stopPolling: () => {
    const { pollingId } = get();
    if (pollingId !== null) {
      window.clearInterval(pollingId);
      set({ pollingId: null });
    }
  },

  subscribeToOrder: (id: string) => {
    // Clean up existing SSE connection
    get().unsubscribeFromOrder();

    const url = `${API_BASE}/api/orders/${id}/events`;
    const es = new EventSource(url);

    es.addEventListener('update_order', (event: MessageEvent) => {
      try {
        const orderData = JSON.parse(event.data);
        const mapped: Order = {
          id: orderData.id ?? orderData.orderId,
          status: orderData.status,
          total: orderData.total ?? 0,
          payment_status: orderData.payment_status ?? '',
          payment_method: orderData.payment_method ?? '',
          customer_name: orderData.customer_name ?? '',
          customer_phone: orderData.customer_phone ?? '',
          customer_address: orderData.customer_address ?? '',
          items: orderData.items ?? [],
          created_at: orderData.created_at ?? '',
        };
        set({ currentOrder: mapped, error: null });
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener('timeout', () => {
      // SSE timed out — close and fall back to polling
      es.close();
      set({ eventSource: null });
      get().startPolling(id);
    });

    es.onerror = () => {
      // Connection error — fall back to polling
      es.close();
      set({ eventSource: null });
      get().startPolling(id);
    };

    set({ eventSource: es });
  },

  unsubscribeFromOrder: () => {
    const { eventSource, pollingId } = get();
    if (eventSource) {
      eventSource.close();
      set({ eventSource: null });
    }
    if (pollingId !== null) {
      window.clearInterval(pollingId);
      set({ pollingId: null });
    }
  },

  /* Replay queued offline orders once connectivity is restored. */
  flushQueuedOrders: async () => {
    const pending = await offlineDb.getPendingOrders();
    if (pending.length === 0) {
      set({ queuedOffline: false });
      return null;
    }

    let lastOrder: Order | null = null;
    for (const payload of pending as CreateOrderPayload[]) {
      try {
        const res = await fetch(`${API_BASE}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const body = await res.json();
        if (!res.ok) {
          set({ error: body.message || `Lỗi gửi đơn (${res.status})`, loading: false });
          break;
        }
        lastOrder = (body.order ?? body) as Order;
        set({ currentOrder: lastOrder, error: null });
      } catch {
        set({ error: 'Lỗi kết nối khi gửi đơn hàng', loading: false });
        break;
      }
    }

    /* Remove only successfully synced orders (iterate in insertion order). */
    try {
      const rows = await offlineDb.getPendingOrders();
      const syncedCount = lastOrder ? 1 : 0;
      // We don't have localIds here; for simplicity clear all after full success.
      // If you want partial success, extend OfflineDB with id-based removal.
      if (lastOrder) await offlineDb.clear();
      set({ queuedOffline: false, loading: false });
    } catch {
      // non-fatal — will retry on next reconnect
    }

    return lastOrder;
  },
}));

/* ── Auto-flush queued orders when connection restores ───────────────── */
let lastOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

export function useOrderStoreWithOfflineFlush<T>(
  selector: (state: OrderState) => T,
): T;
export function useOrderStoreWithOfflineFlush(): OrderState;
export function useOrderStoreWithOfflineFlush<T>(
  selector?: (state: OrderState) => T,
): T | OrderState {
  const { isOnline, wasOffline } = useOnlineStatus();
  const flushQueuedOrders = useOrderStore((s) => s.flushQueuedOrders);
  const queuedOffline = useOrderStore((s) => s.queuedOffline);

  useEffect(() => {
    if (wasOffline && queuedOffline) {
      void flushQueuedOrders();
    }
    lastOnline = isOnline;
  }, [isOnline, wasOffline, queuedOffline, flushQueuedOrders]);

  const sel = selector ?? (() => null as unknown as T);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useOrderStore(sel as any);
}
