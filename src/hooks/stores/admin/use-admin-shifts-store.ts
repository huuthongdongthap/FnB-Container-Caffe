import { create } from 'zustand';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  'https://aura-space-worker.agencyos-openclaw.workers.dev';

export interface ShiftRecord {
  id: string;
  staff_id: string;
  staff_name: string;
  clock_in: string;
  clock_out: string | null;
  hours_worked: number | null;
  date: string;
  notes: string | null;
}

export interface TodayResponse {
  success: boolean;
  data: ShiftRecord[];
}

export interface SingleShiftResponse {
  success: boolean;
  data: ShiftRecord;
}

interface LoadingMap {
  today: boolean;
  history: boolean;
  clockIn: boolean;
  clockOut: boolean;
}

interface AdminShiftsState {
  todayShifts: ShiftRecord[];
  historyShifts: ShiftRecord[];
  loading: LoadingMap;
  error: string | null;
  fetchToday: () => Promise<void>;
  fetchHistory: (staffId?: string) => Promise<void>;
  clockIn: (staffId: string, staffName: string) => Promise<void>;
  clockOut: (staffId: string) => Promise<void>;
  reset: () => void;
}

const initialLoading: LoadingMap = {
  today: false,
  history: false,
  clockIn: false,
  clockOut: false,
};

export const useAdminShiftsStore = create<AdminShiftsState>((set, get) => ({
  todayShifts: [],
  historyShifts: [],
  loading: { ...initialLoading },
  error: null,

  reset: () => {
    set({ todayShifts: [], historyShifts: [], loading: { ...initialLoading }, error: null });
  },

  fetchToday: async () => {
    const { token } = useAuthStore.getState();
    if (!token) {
      set({ error: 'Chưa đăng nhập' });
      return;
    }

    set({ loading: { ...get().loading, today: true }, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/shifts/today`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        useAuthStore.getState().logout();
        set({
          loading: { ...get().loading, today: false },
          error: 'Phiên đăng nhập hết hạn',
        });
        return;
      }

      if (!res.ok) {
        set({
          loading: { ...get().loading, today: false },
          error: 'Không thể tải ca làm việc hôm nay',
        });
        return;
      }

      const body: TodayResponse = await res.json();
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
    const { token } = useAuthStore.getState();
    if (!token) {
      set({ error: 'Chưa đăng nhập' });
      return;
    }

    set({ loading: { ...get().loading, history: true }, error: null });
    try {
      const params = new URLSearchParams();
      if (staffId) params.set('staff_id', staffId);
      params.set('limit', '50');

      const res = await fetch(`${API_BASE}/api/shifts?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        useAuthStore.getState().logout();
        set({
          loading: { ...get().loading, history: false },
          error: 'Phiên đăng nhập hết hạn',
        });
        return;
      }

      if (!res.ok) {
        set({
          loading: { ...get().loading, history: false },
          error: 'Không thể tải lịch sử ca làm việc',
        });
        return;
      }

      const body: TodayResponse = await res.json();
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
    const { token } = useAuthStore.getState();
    if (!token) {
      set({ error: 'Chưa đăng nhập' });
      return;
    }

    set({ loading: { ...get().loading, clockIn: true }, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/shifts/clock-in`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ staff_id: staffId, staff_name: staffName }),
      });

      if (res.status === 401) {
        useAuthStore.getState().logout();
        set({
          loading: { ...get().loading, clockIn: false },
          error: 'Phiên đăng nhập hết hạn',
        });
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        set({
          loading: { ...get().loading, clockIn: false },
          error: body.error || 'Không thể check-in',
        });
        return;
      }

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
    const { token } = useAuthStore.getState();
    if (!token) {
      set({ error: 'Chưa đăng nhập' });
      return;
    }

    set({ loading: { ...get().loading, clockOut: true }, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/shifts/clock-out`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ staff_id: staffId }),
      });

      if (res.status === 401) {
        useAuthStore.getState().logout();
        set({
          loading: { ...get().loading, clockOut: false },
          error: 'Phiên đăng nhập hết hạn',
        });
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        set({
          loading: { ...get().loading, clockOut: false },
          error: body.error || 'Không thể check-out',
        });
        return;
      }

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
