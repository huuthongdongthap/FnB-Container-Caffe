import { create } from 'zustand';

/* ═══════════════════════════════════════════════════════════════════
   Order store — Zustand, no persistence.
   createOrder POST /api/orders, fetchOrder GET /api/orders/:id.
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
}

const TERMINAL_STATUSES = ['delivered', 'cancelled', 'completed'];
const POLL_INTERVAL = 15_000;

interface OrderState {
  currentOrder: Order | null;
  orderHistory: Order[];
  loading: boolean;
  error: string | null;
  pollingId: number | null;

  createOrder: (payload: CreateOrderPayload) => Promise<Order | null>;
  fetchOrder: (id: string) => Promise<void>;
  startPolling: (id: string) => void;
  stopPolling: () => void;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  currentOrder: null,
  orderHistory: [],
  loading: false,
  error: null,
  pollingId: null,

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
}));
