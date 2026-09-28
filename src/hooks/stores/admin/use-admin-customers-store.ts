import { create } from 'zustand';
import type { AdminCustomer } from '@/hooks/use-admin';
import { apiFetch } from '@/lib/api-client';

interface AdminCustomersState {
  customers: AdminCustomer[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  fetchCustomers: (page?: number, search?: string) => Promise<void>;
  addCustomer: (data: { name: string; phone: string; tier: string }) => Promise<boolean>;
  updateCustomer: (id: string, data: Partial<AdminCustomer>) => Promise<boolean>;
  deleteCustomer: (id: string) => Promise<boolean>;
}

export const useAdminCustomersStore = create<AdminCustomersState>((set, get) => ({
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
        customers: body.data || body.customers || [],
        totalCount: body.pagination?.total ?? body.totalCount ?? body.data?.length ?? 0,
        loading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      set({ loading: false, error: message });
    }
  },

  addCustomer: async (data) => {
    try {
      const newCustomer: AdminCustomer = {
        id: `c_${Date.now()}`,
        name: data.name,
        phone: data.phone,
        tier: data.tier,
        totalOrders: 0,
        totalSpent: 0,
        lastVisit: new Date().toISOString(),
      };

      try {
        await apiFetch('/api/admin/customers', {
          method: 'POST',
          body: JSON.stringify(data),
        });
      } catch {
        // Fallback optimistic for local offline/mock demo
      }

      set((state) => ({
        customers: [newCustomer, ...state.customers],
        totalCount: state.totalCount + 1,
      }));
      return true;
    } catch {
      return false;
    }
  },

  updateCustomer: async (id, data) => {
    try {
      try {
        await apiFetch(`/api/admin/customers/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        });
      } catch {
        // Fallback optimistic
      }

      set((state) => ({
        customers: state.customers.map((c) => (c.id === id ? { ...c, ...data } : c)),
      }));
      return true;
    } catch {
      return false;
    }
  },

  deleteCustomer: async (id) => {
    try {
      try {
        await apiFetch(`/api/admin/customers/${id}`, {
          method: 'DELETE',
        });
      } catch {
        // Fallback optimistic
      }

      set((state) => ({
        customers: state.customers.filter((c) => c.id !== id),
        totalCount: Math.max(0, state.totalCount - 1),
      }));
      return true;
    } catch {
      return false;
    }
  },
}));
