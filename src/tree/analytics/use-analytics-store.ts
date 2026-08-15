import { create } from 'zustand';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { API_BASE } from '@/lib/api-client';
import type { AnalyticsStore } from './analytics-store-types';
import { INITIAL } from './analytics-store-constants';
import { fetchSales, fetchComparison, fetchGroups } from './analytics-store-fetchers';
import {
  createSetPeriod,
  createSetCustomRange,
  createSetCompareMode,
  createSetGroupBy,
} from './analytics-store-setters';

/* ═══════════════════════════════════════════════════════════════════
   Sales analytics store — Zustand, no persistence.
   fetchSales       GET /api/admin/metrics?period=...
   fetchComparison  GET /api/admin/metrics?period=...&compare=true
   fetchGroups      GET /api/admin/metrics?period=...&group=...
   exportCsv        GET /api/admin/metrics/export?period=... (triggers download)
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Re-exports for backward compatibility ──────────────────────── */
export type {
  AnalyticsPeriod,
  AnalyticsGroupBy,
  SalesMetrics,
  AnalyticsData,
  AnalyticsGroupRow,
  AnalyticsState,
  AnalyticsActions,
  AnalyticsStore,
} from './analytics-store-types';

export { INITIAL } from './analytics-store-constants';
export { buildBaseParams } from './analytics-store-utils';

/* ─── Store ────────────────────────────────────────────────────────── */

export const useAnalyticsStore = create<AnalyticsStore>((set, get) => ({
  ...INITIAL,

  /* ─── Fetch actions (delegated to fetchers) ──────────────────── */
  fetchSales: () => fetchSales(get, set),
  fetchComparison: () => fetchComparison(get, set),
  fetchGroups: () => fetchGroups(get, set),

  /* ─── Setter actions (delegated to setters) ──────────────────── */
  setPeriod: createSetPeriod(get, set),
  setCustomRange: createSetCustomRange(get, set),
  setCompareMode: createSetCompareMode(get, set),
  setGroupBy: createSetGroupBy(get, set),

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
