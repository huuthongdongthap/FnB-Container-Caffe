import { createPrivateStore as create } from '@/lib/create-private-store';
import { apiFetch } from '@/lib/api-client';
import type { AdminShiftsState, TodayResponse } from './admin-shifts-store-types';
import { INITIAL_LOADING } from './admin-shifts-store-constants';

export type { ShiftRecord, TodayResponse, SingleShiftResponse } from './admin-shifts-store-types';

let latestFetchTodaySeq = 0;
let latestFetchHistorySeq = 0;

export const useAdminShiftsStore = create<AdminShiftsState>((set, get) => ({
  todayShifts: [],
  historyShifts: [],
  loading: { ...INITIAL_LOADING },
  error: null,

  reset: () => {
    set({ todayShifts: [], historyShifts: [], loading: { ...INITIAL_LOADING }, error: null });
  },

  fetchToday: async () => {
    const seq = ++latestFetchTodaySeq;
    set({ loading: { ...get().loading, today: true }, error: null });
    try {
      const body: TodayResponse = await apiFetch<any>('/api/shifts/today');
      if (seq !== latestFetchTodaySeq) return;
      set({
        todayShifts: Array.isArray(body.data) ? body.data : [],
        loading: { ...get().loading, today: false },
      });
    } catch {
      if (seq !== latestFetchTodaySeq) return;
      set({
        loading: { ...get().loading, today: false },
        error: 'Lỗi kết nối khi tải ca làm việc',
      });
    }
  },

  fetchHistory: async (staffId?: string) => {
    const seq = ++latestFetchHistorySeq;
    set({ loading: { ...get().loading, history: true }, error: null });
    try {
      const params = new URLSearchParams();
      if (staffId) params.set('staff_id', staffId);
      params.set('limit', '50');

      const body: TodayResponse = await apiFetch<any>(`/api/shifts?${params.toString()}`);
      if (seq !== latestFetchHistorySeq) return;
      set({
        historyShifts: Array.isArray(body.data) ? body.data : [],
        loading: { ...get().loading, history: false },
      });
    } catch {
      if (seq !== latestFetchHistorySeq) return;
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
