/* ─── Analytics Store Types ──────────────────────────────────────────── */

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

export interface AnalyticsState {
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

export interface AnalyticsActions {
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

export type AnalyticsStore = AnalyticsState & AnalyticsActions;
