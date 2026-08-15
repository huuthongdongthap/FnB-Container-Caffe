import { create } from 'zustand';
import type { AdminCustomer } from '@/hooks/use-admin';
import { apiFetch } from '@/lib/api-client';


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
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set('search', search);

      const body = await apiFetch<any>(`/api/admin/customers?${params}`);
      set({
        customers: body.customers || [],
        totalCount: body.totalCount ?? body.customers?.length ?? 0,
        loading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      set({ loading: false, error: message });
    }
  },
}));
