import { create } from 'zustand';
import { apiFetch } from '@/lib/api-client';
import type { AdminShiftsState, TodayResponse } from './admin-shifts-store-types';
import { INITIAL_LOADING } from './admin-shifts-store-constants';

export type { ShiftRecord, TodayResponse, SingleShiftResponse } from './admin-shifts-store-types';

export const useAdminShiftsStore = create<AdminShiftsState>((set, get) => ({
  todayShifts: [],
  historyShifts: [],
  loading: { ...INITIAL_LOADING },
  error: null,

  reset: () => {
    set({ todayShifts: [], historyShifts: [], loading: { ...INITIAL_LOADING }, error: null });
  },

  fetchToday: async () => {
    set({ loading: { ...get().loading, today: true }, error: null });
    try {
      const body: TodayResponse = await apiFetch<any>('/api/shifts/today');
      set({
        todayShifts: Array.isArray(body.data) ? body.data : [],
        loading: { ...get().loading, today: false },
      });
    } catch {
      set({
        loading: { ...get().loading, today: false },
        error: 'Lỗi kết nối khi tải ca làm việc',
      });
    }
  },

  fetchHistory: async (staffId?: string) => {
    set({ loading: { ...get().loading, history: true }, error: null });
    try {
      const params = new URLSearchParams();
      if (staffId) params.set('staff_id', staffId);
      params.set('limit', '50');

      const body: TodayResponse = await apiFetch<any>(`/api/shifts?${params.toString()}`);
      set({
        historyShifts: Array.isArray(body.data) ? body.data : [],
        loading: { ...get().loading, history: false },
      });
    } catch {
      set({
        loading: { ...get().loading, history: false },
        error: 'Lỗi kết nối khi tải lịch sử ca làm việc',
      });
    }
  },

  clockIn: async (staffId: string, staffName: string) => {
    set({ loading: { ...get().loading, clockIn: true }, error: null });
    try {
      await apiFetch<any>('/api/shifts/clock-in', {
        method: 'POST',
        body: JSON.stringify({ staff_id: staffId, staff_name: staffName }),
      });
      set({ loading: { ...get().loading, clockIn: false } });
      await get().fetchToday();
    } catch {
      set({
        loading: { ...get().loading, clockIn: false },
        error: 'Lỗi kết nối khi check-in',
      });
    }
  },

  clockOut: async (staffId: string) => {
    set({ loading: { ...get().loading, clockOut: true }, error: null });
    try {
      await apiFetch<any>('/api/shifts/clock-out', {
        method: 'POST',
        body: JSON.stringify({ staff_id: staffId }),
      });
      set({ loading: { ...get().loading, clockOut: false } });
      await get().fetchToday();
    } catch {
      set({
        loading: { ...get().loading, clockOut: false },
        error: 'Lỗi kết nối khi check-out',
      });
    }
  },
}));
