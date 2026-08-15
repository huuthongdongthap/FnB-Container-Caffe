import { create } from 'zustand';
import { apiFetch } from '@/lib/api-client';


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
    set({ loading: true, error: null });
    try {
      const body = await apiFetch<any>('/api/admin/reservations');
      set({
        reservations: body.reservations || [],
        loading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      set({ loading: false, error: message });
    }
  },

  approveReservation: async (id) => {
    try {
      await apiFetch<any>(`/api/admin/reservations/${id}/approve`, {
        method: 'PATCH',
      });
      set({ error: null });
      await get().fetchReservations();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      set({ error: message });
    }
  },

  rejectReservation: async (id) => {
    try {
      await apiFetch<any>(`/api/admin/reservations/${id}/reject`, {
        method: 'PATCH',
      });
      set({ error: null });
      await get().fetchReservations();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      set({ error: message });
    }
  },
}));
