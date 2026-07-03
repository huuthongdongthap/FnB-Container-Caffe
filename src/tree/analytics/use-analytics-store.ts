import { create } from 'zustand';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

/* ═══════════════════════════════════════════════════════════════════
   Sales analytics store — Zustand, no persistence.
   fetchSales       GET /api/admin/metrics?period=...
   fetchComparison  GET /api/admin/metrics?period=...&compare=true
   fetchGroups      GET /api/admin/metrics?period=...&group=...
   exportCsv        GET /api/admin/metrics/export?period=... (triggers download)
   ═══════════════════════════════════════════════════════════════════ */

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  'https://aura-space-worker.agencyos-openclaw.workers.dev';

/* ─── Types ──────────────────────────────────────────────────────────── */

export type AnalyticsPeriod = '24h' | '7d' | '30d' | 'custom';
export type AnalyticsGroupBy = 'hour' | 'day' | 'category' | 'payment' | null;

export interface SalesMetrics {
  revenue: number;
  orders: number;
  avg_order_value: number;
  total_products: number;
  total_customers: number;
}

export interface AnalyticsData {
  current: SalesMetrics & {
    period: AnalyticsPeriod;
    start: string;
    end: string;
  };
  previous: SalesMetrics | null;
  groups: AnalyticsGroupRow[];
}

export interface AnalyticsGroupRow {
  label: string;
  revenue: number;
  orders: number;
  avg_order_value: number;
}

/* ─── Store shape ──────────────────────────────────────────────────── */

interface AnalyticsState {
  period: AnalyticsPeriod;
  customStart: string;
  customEnd: string;
  compareMode: boolean;
  groupBy: AnalyticsGroupBy;
  data: AnalyticsData | null;
  loading: boolean;
  error: string | null;
  _requestId: number;
}

interface AnalyticsActions {
  fetchSales: () => Promise<void>;
  fetchComparison: () => Promise<void>;
  fetchGroups: () => Promise<void>;
  setPeriod: (period: AnalyticsPeriod) => Promise<void>;
  setCustomRange: (start: string, end: string) => Promise<void>;
  setCompareMode: (enabled: boolean) => Promise<void>;
  setGroupBy: (groupBy: AnalyticsGroupBy) => Promise<void>;
  exportCsv: () => Promise<void>;
  reset: () => void;
}

type AnalyticsStore = AnalyticsState & AnalyticsActions;

/* ─── Initial state ───────────────────────────────────────────────── */

const INITIAL: AnalyticsState = {
  period: '7d',
  customStart: '',
  customEnd: '',
  compareMode: false,
  groupBy: null,
  data: null,
  loading: false,
  error: null,
  _requestId: 0,
};

/* ─── Helpers ──────────────────────────────────────────────────────── */

function buildBaseParams(state: AnalyticsState): URLSearchParams {
  const params = new URLSearchParams();
  params.set('period', state.period);
  if (state.period === 'custom') {
    if (state.customStart) params.set('start', state.customStart);
    if (state.customEnd) params.set('end', state.customEnd);
  }
  return params;
}

/* ─── Store ────────────────────────────────────────────────────────── */

export const useAnalyticsStore = create<AnalyticsStore>((set, get) => ({
  ...INITIAL,

  /* ─── Fetch main sales data ──────────────────────────────────── */
  fetchSales: async () => {
    const token = useAuthStore.getState().token;
    if (!token) {
      set({ error: 'Chưa đăng nhập', loading: false });
      return;
    }

    const requestId = get()._requestId + 1;
    set({ loading: true, error: null, _requestId: requestId });

    try {
      const params = buildBaseParams(get());
      const res = await fetch(`${API_BASE}/api/admin/metrics?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (get()._requestId !== requestId) return;

      if (res.status === 401) {
        useAuthStore.getState().logout();
        set({ loading: false, error: 'Phiên đăng nhập hết hạn' });
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (get()._requestId !== requestId) return;
        set({ loading: false, error: body.error || 'Không thể tải dữ liệu doanh thu' });
        return;
      }

      const json: AnalyticsData = await res.json();
      if (get()._requestId !== requestId) return;
      set({ data: json, loading: false, error: null });
    } catch (err) {
      if (get()._requestId !== requestId) return;
      set({ loading: false, error: err instanceof Error ? err.message : 'Lỗi kết nối' });
    }
  },

  /* ─── Fetch comparison period data ──────────────────────────── */
  fetchComparison: async () => {
    if (!get().compareMode) return;

    const token = useAuthStore.getState().token;
    if (!token) {
      set({ error: 'Chưa đăng nhập', loading: false });
      return;
    }

    const requestId = get()._requestId + 1;
    set({ loading: true, error: null, _requestId: requestId });

    try {
      const params = buildBaseParams(get());
      params.set('compare', 'true');
      const res = await fetch(`${API_BASE}/api/admin/metrics?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (get()._requestId !== requestId) return;

      if (res.status === 401) {
        useAuthStore.getState().logout();
        set({ loading: false, error: 'Phiên đăng nhập hết hạn' });
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (get()._requestId !== requestId) return;
        set({ loading: false, error: body.error || 'Không thể tải dữ liệu so sánh' });
        return;
      }

      const json: AnalyticsData = await res.json();
      if (get()._requestId !== requestId) return;

      // Merge comparison data into current data
      const prev = get().data;
      set({
        data: prev
          ? { ...prev, previous: json.current }
          : { current: json.current, previous: null, groups: json.groups },
        loading: false,
        error: null,
      });
    } catch (err) {
      if (get()._requestId !== requestId) return;
      set({ loading: false, error: err instanceof Error ? err.message : 'Lỗi kết nối' });
    }
  },

  /* ─── Fetch grouped analytics data ──────────────────────────── */
  fetchGroups: async () => {
    const groupBy = get().groupBy;
    if (!groupBy) return;

    const token = useAuthStore.getState().token;
    if (!token) {
      set({ error: 'Chưa đăng nhập', loading: false });
      return;
    }

    const requestId = get()._requestId + 1;
    set({ loading: true, error: null, _requestId: requestId });

    try {
      const params = buildBaseParams(get());
      params.set('group', groupBy);
      const res = await fetch(`${API_BASE}/api/admin/metrics?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (get()._requestId !== requestId) return;

      if (res.status === 401) {
        useAuthStore.getState().logout();
        set({ loading: false, error: 'Phiên đăng nhập hết hạn' });
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (get()._requestId !== requestId) return;
        set({ loading: false, error: body.error || 'Không thể tải dữ liệu nhóm' });
        return;
      }

      const json: { groups: AnalyticsGroupRow[] } = await res.json();
      if (get()._requestId !== requestId) return;

      const prev = get().data;
      set({
        data: prev ? { ...prev, groups: json.groups } : { current: {} as any, previous: null, groups: json.groups },
        loading: false,
        error: null,
      });
    } catch (err) {
      if (get()._requestId !== requestId) return;
      set({ loading: false, error: err instanceof Error ? err.message : 'Lỗi kết nối' });
    }
  },

  /* ─── Period setter ─────────────────────────────────────────── */
  setPeriod: async (period) => {
    set({ period, error: null, data: null });
    await get().fetchSales();
    if (get().compareMode) await get().fetchComparison();
    if (get().groupBy) await get().fetchGroups();
  },

  /* ─── Custom range setter ───────────────────────────────────── */
  setCustomRange: async (start, end) => {
    set({ customStart: start, customEnd: end, period: 'custom', error: null, data: null });
    await get().fetchSales();
    if (get().compareMode) await get().fetchComparison();
    if (get().groupBy) await get().fetchGroups();
  },

  /* ─── Compare mode toggle ───────────────────────────────────── */
  setCompareMode: async (enabled) => {
    set({ compareMode: enabled, error: null });
    if (enabled) {
      await get().fetchComparison();
    } else {
      // Clear previous comparison data
      const prev = get().data;
      if (prev) {
        set({ data: { ...prev, previous: null } });
      }
    }
  },

  /* ─── GroupBy setter ────────────────────────────────────────── */
  setGroupBy: async (groupBy) => {
    set({ groupBy, error: null });
    if (groupBy) {
      // Clear old groups before fetching new ones
      const prev = get().data;
      if (prev) {
        set({ data: { ...prev, groups: [] } });
      }
      await get().fetchGroups();
    } else {
      const prev = get().data;
      if (prev) {
        set({ data: { ...prev, groups: [] } });
      }
    }
  },

  /* ─── CSV export ────────────────────────────────────────────── */
  exportCsv: async () => {
    const token = useAuthStore.getState().token;
    if (!token) {
      set({ error: 'Chưa đăng nhập' });
      return;
    }

    const params = new URLSearchParams();
    params.set('period', get().period);
    if (get().period === 'custom') {
      if (get().customStart) params.set('start', get().customStart);
      if (get().customEnd) params.set('end', get().customEnd);
    }

    const res = await fetch(`${API_BASE}/api/admin/metrics/export?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      set({ error: body.error || 'Xuất CSV thất bại' });
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-analytics-${get().period}-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /* ─── Reset ─────────────────────────────────────────────────── */
  reset: () => set({ ...INITIAL }),
}));
