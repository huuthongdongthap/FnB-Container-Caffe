import { create } from 'zustand';
import type { AdminOrder } from '@/hooks/use-admin';
import { apiFetch } from '@/lib/api-client';


export interface OrderFilters {
  status?: string;
  payment?: string;
  search?: string;
}

interface AdminOrdersState {
  orders: AdminOrder[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  fetchOrders: (page?: number, filters?: OrderFilters) => Promise<void>;
  updateOrderStatus: (orderId: string, status: string) => Promise<void>;
}

function normalizeAdminOrder(raw: Record<string, unknown>): AdminOrder {
  if (
    typeof raw.customer === 'string' &&
    typeof raw.items === 'number' &&
    typeof raw.payment === 'string' &&
    typeof raw.createdAt === 'string'
  ) {
    return raw as unknown as AdminOrder;
  }
  let itemsCount = 1;
  if (typeof raw.items === 'number') {
    itemsCount = raw.items;
  } else if (Array.isArray(raw.items)) {
    itemsCount = raw.items.reduce(
      (sum: number, it: Record<string, unknown>) => sum + (typeof it?.quantity === 'number' ? it.quantity : 1),
      0
    ) || raw.items.length;
  } else if (typeof raw.items === 'string' || typeof raw.items_json === 'string') {
    try {
      const parsed = JSON.parse(String(raw.items ?? raw.items_json));
      if (Array.isArray(parsed)) {
        itemsCount = parsed.reduce(
          (sum: number, it: Record<string, unknown>) => sum + (typeof it?.quantity === 'number' ? it.quantity : 1),
          0
        ) || parsed.length;
      }
    } catch {
      itemsCount = 1;
    }
  }
  return {
    ...(raw as unknown as AdminOrder),
    id: String(raw.id ?? ''),
    customer: String(raw.customer ?? raw.customerName ?? raw.customer_name ?? 'Guest'),
    items: itemsCount,
    total: Number(raw.total ?? 0),
    status: String(raw.status ?? 'pending'),
    payment: String(raw.payment ?? raw.paymentMethod ?? raw.payment_method ?? raw.payment_status ?? 'cash'),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
  };
}

export const useAdminOrdersStore = create<AdminOrdersState>((set, get) => ({
  orders: [],
  totalCount: 0,
  loading: false,
  error: null,

  fetchOrders: async (page = 1, filters?: OrderFilters) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (filters?.status) params.set('status', filters.status);
      if (filters?.payment) params.set('payment_status', filters.payment);
      if (filters?.search) params.set('search', filters.search);

      const body = await apiFetch<{
        orders?: Array<Record<string, unknown>>;
        data?: Array<Record<string, unknown>>;
        totalCount?: number;
        pagination?: { total?: number };
      }>(`/api/admin/orders?${params}`);
      const rawOrders: Array<Record<string, unknown>> = body?.orders || body?.data || [];
      set({
        orders: rawOrders.map(normalizeAdminOrder),
        totalCount: body?.totalCount ?? body?.pagination?.total ?? rawOrders.length ?? 0,
        loading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      set({ loading: false, error: message });
    }
  },

  updateOrderStatus: async (orderId, status) => {
    try {
      await apiFetch<Record<string, unknown>>(`/api/orders/${orderId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await get().fetchOrders();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      set({ error: message });
    }
  },
}));
