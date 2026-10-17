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

function normalizeReservation(raw: Record<string, unknown>): AdminReservation {
  if (
    typeof raw.customerName === 'string' &&
    typeof raw.tableNumber === 'string' &&
    typeof raw.guests === 'number' &&
    typeof raw.createdAt === 'string'
  ) {
    return raw as unknown as AdminReservation;
  }
  return {
    ...(raw as unknown as AdminReservation),
    id: String(raw.id ?? ''),
    customerName: String(raw.customerName ?? raw.customer_name ?? ''),
    customerPhone: String(raw.customerPhone ?? raw.customer_phone ?? ''),
    tableNumber: String(raw.tableNumber ?? raw.table_number ?? raw.table_id ?? ''),
    zone: String(raw.zone ?? raw.table_zone ?? ''),
    date: String(raw.date ?? ''),
    time: String(raw.time ?? ''),
    guests: Number(raw.guests ?? raw.guest_count ?? 2),
    status: (raw.status as AdminReservation['status']) || 'pending',
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
  };
}

export const useAdminReservationsStore = create<AdminReservationsState>((set, get) => ({
  reservations: [],
  loading: false,
  error: null,

  fetchReservations: async () => {
    set({ loading: true, error: null });
    try {
      const body = await apiFetch<any>('/api/reservations');
      const rawList: Array<Record<string, unknown>> = body?.reservations || body?.data || [];
      set({
        reservations: rawList.map(normalizeReservation),
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
