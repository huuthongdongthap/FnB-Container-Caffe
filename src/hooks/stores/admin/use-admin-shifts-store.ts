import { createPrivateStore as create } from '@/lib/create-private-store';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import type {
  AdminShiftsState,
  ClockInOptions,
  ShiftRecord,
  SingleShiftResponse,
  TodayResponse,
} from './admin-shifts-store-types';
import { INITIAL_LOADING } from './admin-shifts-store-constants';

export type {
  ShiftRecord,
  ClockInOptions,
  CashDenominationEntry,
  ShiftReconciliationRecord,
  TodayResponse,
  SingleShiftResponse,
} from './admin-shifts-store-types';

let latestFetchTodaySeq = 0;
let latestFetchHistorySeq = 0;

function extractShiftError(err: unknown, fallback: string): string {
  if (err instanceof ApiClientError && err.message) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

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
      const body = await apiFetch<TodayResponse>('/api/shifts/today');
      if (seq !== latestFetchTodaySeq) return;
      set({
        todayShifts: Array.isArray(body.data) ? body.data : [],
        loading: { ...get().loading, today: false },
      });
    } catch (err) {
      if (seq !== latestFetchTodaySeq) return;
      set({
        loading: { ...get().loading, today: false },
        error: extractShiftError(err, 'Lỗi kết nối khi tải ca làm việc'),
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

      const body = await apiFetch<TodayResponse>(`/api/shifts?${params.toString()}`);
      if (seq !== latestFetchHistorySeq) return;
      set({
        historyShifts: Array.isArray(body.data) ? body.data : [],
        loading: { ...get().loading, history: false },
      });
    } catch (err) {
      if (seq !== latestFetchHistorySeq) return;
      set({
        loading: { ...get().loading, history: false },
        error: extractShiftError(err, 'Lỗi kết nối khi tải lịch sử ca làm việc'),
      });
    }
  },

  clockIn: async (staffId: string, _staffName: string, options?: ClockInOptions): Promise<ShiftRecord | null> => {
    set({ loading: { ...get().loading, clockIn: true }, error: null });
    try {
      const payload: Record<string, unknown> = {
        staff_id: staffId,
      };
      if (options?.openingCash !== undefined) {
        payload.opening_cash = options.openingCash;
      } else if (!options?.scheduledShiftId) {
        payload.opening_cash = 0;
      }
      if (options?.scheduledShiftId) payload.scheduled_shift_id = options.scheduledShiftId;
      if (options?.notes?.trim()) payload.notes = options.notes.trim();

      const body = await apiFetch<SingleShiftResponse>('/api/shifts/clock-in', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      set({ loading: { ...get().loading, clockIn: false } });
      await Promise.all([get().fetchToday(), get().fetchHistory()]);
      return body.data ?? null;
    } catch (err) {
      set({
        loading: { ...get().loading, clockIn: false },
        error: extractShiftError(err, 'Lỗi kết nối khi check-in'),
      });
      return null;
    }
  },

  clockOut: async (staffId: string, notes?: string): Promise<ShiftRecord | null> => {
    set({ loading: { ...get().loading, clockOut: true }, error: null });
    try {
      const payload: Record<string, unknown> = { staff_id: staffId };
      if (notes?.trim()) payload.notes = notes.trim();

      const body = await apiFetch<SingleShiftResponse>('/api/shifts/clock-out', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      set({ loading: { ...get().loading, clockOut: false } });
      await Promise.all([get().fetchToday(), get().fetchHistory()]);
      return body.data ?? null;
    } catch (err) {
      set({
        loading: { ...get().loading, clockOut: false },
        error: extractShiftError(err, 'Lỗi kết nối khi check-out'),
      });
      return null;
    }
  },
}));
