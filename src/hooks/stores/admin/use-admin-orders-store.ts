import { create } from 'zustand';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import type { AdminOrder } from '@/hooks/use-admin';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://aura-space-worker.agencyos-openclaw.workers.dev';

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
    const { token } = useAuthStore.getState();
    if (!token) {
      set({ error: 'Chưa đăng nhập', loading: false });
      return;
    }

    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (filters?.status) params.set('status', filters.status);
      if (filters?.payment) params.set('payment', filters.payment);
      if (filters?.search) params.set('search', filters.search);

      const res = await fetch(`${API_BASE}/api/admin/orders?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        useAuthStore.getState().logout();
        set({ loading: false, error: 'Phiên đăng nhập hết hạn' });
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        set({ loading: false, error: body.message || 'Không thể tải danh sách đơn hàng' });
        return;
      }

      const body = await res.json();
      set({
        orders: body.orders || [],
        totalCount: body.totalCount ?? body.orders?.length ?? 0,
        loading: false,
        error: null,
      });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Lỗi kết nối' });
    }
  },

  updateOrderStatus: async (orderId, status) => {
    const { token } = useAuthStore.getState();
    if (!token) {
      set({ error: 'Chưa đăng nhập' });
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (res.status === 401) {
        useAuthStore.getState().logout();
        set({ error: 'Phiên đăng nhập hết hạn' });
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        set({ error: body.message || 'Không thể cập nhật trạng thái' });
        return;
      }

      // Refresh orders after successful update
      await get().fetchOrders();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Lỗi kết nối' });
    }
  },
}));
