import { create } from 'zustand';
import { apiFetch } from '@/lib/api-client';

/* ═══════════════════════════════════════════════════════════════════
   Reservation store — Zustand for table booking flow.
   Pattern: matches use-auth-store.ts — manual fetch, no middleware.
   ═══════════════════════════════════════════════════════════════════ */


export interface TimeSlot {
  time: string;
  available: boolean;
}

export interface TableInfo {
  id: string;
  table_number: string;
  zone: string;
  available: boolean;
}

export interface ReservationPayload {
  table_id: string;
  customer_name: string;
  customer_phone: string;
  guest_count: number;
  date: string;
  time: string;
}

interface ReservationState {
  availableSlots: TimeSlot[];
  tables: TableInfo[];
  currentReservation: { id: string; table_number?: string } | null;
  loading: boolean;
  error: string | null;

  fetchSlots: (date: string, time: string) => Promise<void>;
  createReservation: (data: ReservationPayload) => Promise<{ id: string } | null>;
  clearError: () => void;
  reset: () => void;
}

export const useReservationStore = create<ReservationState>((set) => ({
  availableSlots: [],
  tables: [],
  currentReservation: null,
  loading: false,
  error: null,

  fetchSlots: async (date, time) => {
    set({ loading: true, error: null });
    try {
      const body = await apiFetch<any>(
        `/api/reservations/availability?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`,
      );

      set({
        availableSlots: body.data?.slots ?? [],
        tables: body.data?.tables ?? [],
        loading: false,
        error: null,
      });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Network error' });
    }
  },

  createReservation: async (data) => {
    set({ loading: true, error: null });
    try {
      const body = await apiFetch<any>('/api/reservations', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      const reservation = body.data ?? body;
      set({
        currentReservation: reservation,
        loading: false,
        error: null,
      });
      return reservation;
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Network error' });
      return null;
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set({
    availableSlots: [],
    tables: [],
    currentReservation: null,
    loading: false,
    error: null,
  }),
}));
