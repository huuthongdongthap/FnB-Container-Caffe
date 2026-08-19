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

      const body = await apiFetch<any>(`/api/admin/orders?${params}`);
      set({
        orders: body.orders || [],
        totalCount: body.totalCount ?? body.orders?.length ?? 0,
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
      await apiFetch<any>(`/api/orders/${orderId}`, {
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
