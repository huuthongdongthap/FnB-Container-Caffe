import type { AnalyticsState } from './analytics-store-types';

/* ─── Initial state ───────────────────────────────────────────────── */

export const INITIAL: AnalyticsState = {
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
