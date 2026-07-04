import { create } from 'zustand';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { API_BASE } from '@/lib/api-client';


export interface AdminReservation {
  id: string;
  customerName: string;
  customerPhone: string;
  tableNumber: string;
  zone: string;
  date: string;
  time: string;
  guests: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  createdAt: string;
}

interface AdminReservationsState {
  reservations: AdminReservation[];
  loading: boolean;
  error: string | null;
  fetchReservations: () => Promise<void>;
  approveReservation: (id: string) => Promise<void>;
  rejectReservation: (id: string) => Promise<void>;
}

export const useAdminReservationsStore = create<AdminReservationsState>((set, get) => ({
  reservations: [],
  loading: false,
  error: null,

  fetchReservations: async () => {
    const { token } = useAuthStore.getState();
    if (!token) {
      set({ error: 'Chưa đăng nhập', loading: false });
      return;
    }

    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/admin/reservations`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        useAuthStore.getState().logout();
        set({ loading: false, error: 'Phiên đăng nhập hết hạn' });
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        set({ loading: false, error: body.message || 'Không thể tải danh sách đặt bàn' });
        return;
      }

      const body = await res.json();
      set({
        reservations: body.reservations || [],
        loading: false,
        error: null,
      });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Lỗi kết nối' });
    }
  },

  approveReservation: async (id) => {
    const { token } = useAuthStore.getState();
    if (!token) {
      set({ error: 'Chưa đăng nhập' });
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/reservations/${id}/approve`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.status === 401) {
        useAuthStore.getState().logout();
        set({ error: 'Phiên đăng nhập hết hạn' });
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        set({ error: body.message || 'Không thể duyệt đặt bàn' });
        return;
      }

      set({ error: null });
      await get().fetchReservations();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Lỗi kết nối' });
    }
  },

  rejectReservation: async (id) => {
    const { token } = useAuthStore.getState();
    if (!token) {
      set({ error: 'Chưa đăng nhập' });
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/reservations/${id}/reject`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.status === 401) {
        useAuthStore.getState().logout();
        set({ error: 'Phiên đăng nhập hết hạn' });
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        set({ error: body.message || 'Không thể từ chối đặt bàn' });
        return;
      }

      set({ error: null });
      await get().fetchReservations();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Lỗi kết nối' });
    }
  },
}));
