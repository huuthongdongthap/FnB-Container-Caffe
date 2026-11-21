import { createPrivateStore as create } from '@/lib/create-private-store';
import { apiFetch } from '@/lib/api-client';

export interface AdminReservation {
  id: string;
  customerName: string;
  customerPhone: string;
  tableNumber: string;
  tableId?: string;
  zone: string;
  date: string;
  time: string;
  guests: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'seated' | 'approved' | 'rejected' | 'no_show';
  createdAt: string;
  notes?: string;
}

interface AdminReservationsState {
  reservations: AdminReservation[];
  loading: boolean;
  error: string | null;
  offset: number;
  hasNext: boolean;
  filters: { date?: string; status?: string };
  fetchReservations: (options?: { offset?: number; date?: string; status?: string }) => Promise<void>;
  updateReservation: (id: string, data: Record<string, string | number>) => Promise<boolean>;
  changeStatus: (id: string, status: string) => Promise<boolean>;
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
    tableId: String(raw.tableId ?? raw.table_id ?? ''),
    notes: String(raw.notes ?? ''),
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

let latestFetchReservationsSeq = 0;

export const useAdminReservationsStore = create<AdminReservationsState>((set, get) => ({
  reservations: [],
  loading: false,
  error: null,
  offset: 0,
  hasNext: false,
  filters: {},

  fetchReservations: async (options) => {
    const filters = options ? { date: options.date, status: options.status } : get().filters;
    const offset = options?.offset ?? get().offset;
    const params = new URLSearchParams({ limit: '50', offset: String(offset) });
    if (filters.date) params.set('date', filters.date);
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    const seq = ++latestFetchReservationsSeq;
    set({ loading: true, error: null });
    try {
      const body = await apiFetch<{ success?: boolean; error?: string; reservations?: unknown; data?: unknown }>(`/api/reservations?${params}`);
      if (body.success === false) throw new Error(body.error || 'Không thể tải đặt bàn');
      if (seq !== latestFetchReservationsSeq) return;
      const list = body.reservations ?? body.data ?? [];
      if (!Array.isArray(list) || list.some(row => !row || typeof row !== 'object' || typeof row.id !== 'string')) {
        throw new Error('Invalid reservation response');
      }
      const rawList = list as Array<Record<string, unknown>>;
      set({ reservations: rawList.map(normalizeReservation), offset, filters, hasNext: rawList.length === 50, loading: false, error: null });
    } catch (err) {
      if (seq !== latestFetchReservationsSeq) return;
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      set({ loading: false, error: message });
    }
  },

  updateReservation: async (id, data) => {
    try {
      await apiFetch<unknown>(`/api/reservations/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) });
      await get().fetchReservations();
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Lỗi kết nối' });
      return false;
    }
  },

  changeStatus: async (id, status) => {
    try {
      const cancel = status === 'cancelled';
      await apiFetch<unknown>(`/api/reservations/${encodeURIComponent(id)}/${cancel ? 'cancel' : 'status'}`, {
        method: cancel ? 'POST' : 'PATCH', ...(cancel ? {} : { body: JSON.stringify({ status }) }),
      });
      await get().fetchReservations();
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Lỗi kết nối' });
      return false;
    }
  },

  approveReservation: async (id) => {
    try {
      await apiFetch<unknown>(`/api/admin/reservations/${id}/approve`, { method: 'PATCH' });
      set({ error: null });
      await get().fetchReservations();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Lỗi kết nối' });
    }
  },

  rejectReservation: async (id) => {
    try {
      await apiFetch<unknown>(`/api/admin/reservations/${id}/reject`, { method: 'PATCH' });
      set({ error: null });
      await get().fetchReservations();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Lỗi kết nối' });
    }
  },
}));
