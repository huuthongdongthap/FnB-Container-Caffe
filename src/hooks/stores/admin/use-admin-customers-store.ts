import { create } from 'zustand';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import type { AdminCustomer } from '@/hooks/use-admin';
import { API_BASE } from '@/lib/api-client';


interface AdminCustomersState {
  customers: AdminCustomer[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  fetchCustomers: (page?: number, search?: string) => Promise<void>;
}

export const useAdminCustomersStore = create<AdminCustomersState>((set) => ({
  customers: [],
  totalCount: 0,
  loading: false,
  error: null,

  fetchCustomers: async (page = 1, search?: string) => {
    const { token } = useAuthStore.getState();
    if (!token) {
      set({ error: 'Chưa đăng nhập', loading: false });
      return;
    }

    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set('search', search);

      const res = await fetch(`${API_BASE}/api/admin/customers?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        useAuthStore.getState().logout();
        set({ loading: false, error: 'Phiên đăng nhập hết hạn' });
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        set({ loading: false, error: body.message || 'Không thể tải danh sách khách hàng' });
        return;
      }

      const body = await res.json();
      set({
        customers: body.customers || [],
        totalCount: body.totalCount ?? body.customers?.length ?? 0,
        loading: false,
        error: null,
      });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Lỗi kết nối' });
    }
  },
}));
