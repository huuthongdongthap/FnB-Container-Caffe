import type { AnalyticsPeriod, AnalyticsGroupBy, AnalyticsState, AnalyticsData } from './analytics-store-types';

/* ─── Setter helpers for analytics store ────────────────────────────── */

type SetFn = (partial: Partial<AnalyticsState>) => void;
type GetFn = () => AnalyticsState & {
  fetchSales: () => Promise<void>;
  fetchComparison: () => Promise<void>;
  fetchGroups: () => Promise<void>;
};

export function createSetPeriod(get: GetFn, set: SetFn) {
  return async (period: AnalyticsPeriod) => {
    set({ period, error: null, data: null });
    await get().fetchSales();
    if (get().compareMode) await get().fetchComparison();
    if (get().groupBy) await get().fetchGroups();
  };
}

export function createSetCustomRange(get: GetFn, set: SetFn) {
  return async (start: string, end: string) => {
    set({ customStart: start, customEnd: end, period: 'custom', error: null, data: null });
    await get().fetchSales();
    if (get().compareMode) await get().fetchComparison();
    if (get().groupBy) await get().fetchGroups();
  };
}

export function createSetCompareMode(get: GetFn, set: SetFn) {
  return async (enabled: boolean) => {
    set({ compareMode: enabled, error: null });
    if (enabled) {
      await get().fetchComparison();
    } else {
      const prev = get().data;
      if (prev) {
        set({ data: { ...prev, previous: null } });
      }
    }
  };
}

export function createSetGroupBy(get: GetFn, set: SetFn) {
  return async (groupBy: AnalyticsGroupBy) => {
    set({ groupBy, error: null });
    if (groupBy) {
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
  };
}
