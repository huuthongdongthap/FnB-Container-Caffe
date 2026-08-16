import { create } from 'zustand';
import { apiFetch } from '@/lib/api-client';

/* ═══════════════════════════════════════════════════════════════════
   Metrics store — fetches /api/admin/metrics?range= for dashboard.
   Pattern: matches use-admin-dashboard-store.ts — apiFetch, cache.
   Includes request sequence counter to prevent stale range-switch races.
   ═══════════════════════════════════════════════════════════════════ */

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
    const { range, lastFetched, data } = get();
    const lastFetch = lastFetched[range];
    if (data?.range === range && lastFetch && Date.now() - lastFetch < CACHE_TTL) {
      return;
    }

    const requestId = get()._requestId + 1;
    set({ loading: true, error: null, _requestId: requestId });
    try {
      const json: MetricsData = await apiFetch<any>(`/api/admin/metrics?range=${range}`);
      if (get()._requestId !== requestId) return;
      set({
        data: json,
        loading: false,
        error: null,
        lastFetched: { ...lastFetched, [range]: Date.now() },
      });
    } catch (err) {
      if (get()._requestId !== requestId) return;
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      set({ loading: false, error: message });
    }
  },
}));
