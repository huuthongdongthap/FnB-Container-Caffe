import { create } from 'zustand';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

/* ═══════════════════════════════════════════════════════════════════
   Metrics store — fetches /api/admin/metrics?range= for dashboard.
   Pattern: matches use-admin-dashboard-store.ts — Bearer token, cache.
   Includes request sequence counter to prevent stale range-switch races.
   ═══════════════════════════════════════════════════════════════════ */

const API_BASE = import.meta.env.VITE_API_BASE || 'https://aura-space-worker.agencyos-openclaw.workers.dev';
const CACHE_TTL = 60_000; // 1 minute

export interface MetricsData {
  range: string;
  since: string;
  generated_at: string;
  requests: { total: number };
  errors: { total: number };
  orders: { total: number };
  revenue: { total: number };
  latency: { p50: number; p95: number };
  topPaths: Array<{ path: string; count: number }>;
}

export type MetricsRange = '24h' | '7d' | '30d';

interface MetricsState {
  range: MetricsRange;
  data: MetricsData | null;
  loading: boolean;
  error: string | null;
  lastFetched: Record<string, number>;
  _requestId: number;
  setRange: (range: MetricsRange) => void;
  fetchMetrics: () => Promise<void>;
}

export const useMetricsStore = create<MetricsState>((set, get) => ({
  range: '24h',
  data: null,
  loading: false,
  error: null,
  lastFetched: {},
  _requestId: 0,

  setRange: (range) => {
    set({ range, error: null, data: null }); // clear stale data on range switch
    get().fetchMetrics();
  },

  fetchMetrics: async () => {
    const { token } = useAuthStore.getState();
    if (!token) {
      set({ error: 'Chưa đăng nhập', loading: false });
      return;
    }

    const { range, lastFetched, data } = get();
    const lastFetch = lastFetched[range];
    if (data?.range === range && lastFetch && Date.now() - lastFetch < CACHE_TTL) {
      return;
    }

    const requestId = get()._requestId + 1;
    set({ loading: true, error: null, _requestId: requestId });
    try {
      const res = await fetch(`${API_BASE}/api/admin/metrics?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Drop stale responses from rapid range switching
      if (get()._requestId !== requestId) return;

      if (res.status === 401) {
        useAuthStore.getState().logout();
        set({ loading: false, error: 'Phiên đăng nhập hết hạn' });
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (get()._requestId !== requestId) return;
        set({ loading: false, error: body.error || 'Không thể tải metrics' });
        return;
      }

      const json: MetricsData = await res.json();
      if (get()._requestId !== requestId) return;
      set({
        data: json,
        loading: false,
        error: null,
        lastFetched: { ...lastFetched, [range]: Date.now() },
      });
    } catch (err) {
      if (get()._requestId !== requestId) return;
      set({ loading: false, error: err instanceof Error ? err.message : 'Lỗi kết nối' });
    }
  },
}));
