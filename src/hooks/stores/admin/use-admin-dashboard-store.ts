import { create } from 'zustand';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import type { AdminStats } from '@/hooks/use-admin';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://aura-space-worker.agencyos-openclaw.workers.dev';

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
    const { token } = useAuthStore.getState();
    if (!token) {
      set({ error: 'Chưa đăng nhập', loading: false });
      return;
    }

    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        useAuthStore.getState().logout();
        set({ loading: false, error: 'Phiên đăng nhập hết hạn' });
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        set({ loading: false, error: body.message || 'Không thể tải thống kê' });
        return;
      }

      const body = await res.json();
      set({
        stats: body,
        loading: false,
        error: null,
      });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Lỗi kết nối' });
    }
  },
}));
