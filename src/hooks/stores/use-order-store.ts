import { create } from 'zustand';

/* ═══════════════════════════════════════════════════════════════════
   Order store — Zustand, no persistence.
   createOrder POST /api/orders, fetchOrder GET /api/orders/:id.
   SSE subscription for real-time order status updates.
   ═══════════════════════════════════════════════════════════════════ */

const API_BASE = import.meta.env.VITE_API_BASE || 'https://aura-space-worker.agencyos-openclaw.workers.dev';

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

  createOrder: (payload: CreateOrderPayload) => Promise<Order | null>;
  fetchOrder: (id: string) => Promise<void>;
  startPolling: (id: string) => void;
  stopPolling: () => void;
  subscribeToOrder: (id: string) => void;
  unsubscribeFromOrder: () => void;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  currentOrder: null,
  orderHistory: [],
  loading: false,
  error: null,
  pollingId: null,
  eventSource: null,

  createOrder: async (payload) => {
    set({ loading: true, error: null });
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
      set({ currentOrder: order, loading: false, error: null });
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
}));
