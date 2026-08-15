import { create } from 'zustand';
import type { AdminStats } from '@/hooks/use-admin';
import { apiFetch } from '@/lib/api-client';


interface AdminDashboardState {
  stats: AdminStats | null;
  loading: boolean;
  error: string | null;
  fetchDashboard: () => Promise<void>;
}

export const useAdminDashboardStore = create<AdminDashboardState>((set) => ({
  stats: null,
  loading: false,
  error: null,

  fetchDashboard: async () => {
    set({ loading: true, error: null });
    try {
      const body = await apiFetch<any>('/api/stats');
      set({
        stats: body,
        loading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      set({ loading: false, error: message });
    }
  },
}));
