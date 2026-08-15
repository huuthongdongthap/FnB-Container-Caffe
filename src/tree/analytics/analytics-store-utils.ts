import type { AnalyticsState } from './analytics-store-types';

/* ─── Helpers ──────────────────────────────────────────────────────── */

export function buildBaseParams(state: AnalyticsState): URLSearchParams {
  const params = new URLSearchParams();
  params.set('period', state.period);
  if (state.period === 'custom') {
    if (state.customStart) params.set('start', state.customStart);
    if (state.customEnd) params.set('end', state.customEnd);
  }
  return params;
}
