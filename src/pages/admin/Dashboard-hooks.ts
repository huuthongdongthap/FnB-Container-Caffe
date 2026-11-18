import { useState, useCallback, useMemo } from 'react';
import {
  useTopProducts,
  usePeakHours,
  useCustomerMetrics,
  useDailyRevenue,
  useZoneStats,
  downloadAnalyticsCsv,
} from '@/hooks/use-analytics-data';
import type { Period } from './Dashboard-constants';

const ICT_OFFSET_MS = 7 * 3600_000;

export function getPeriodStoreDateRange(period: Period, nowMs = Date.now()): { from: string; to: string; days: number } {
  const days = period === 'weekly' ? 7 : period === 'monthly' ? 90 : 30;
  const to = new Date(nowMs + ICT_OFFSET_MS).toISOString().slice(0, 10);
  const from = new Date(nowMs + ICT_OFFSET_MS - (days - 1) * 86400_000).toISOString().slice(0, 10);
  return { from, to, days };
}

export interface DashboardAnalytics {
  topProducts: ReturnType<typeof useTopProducts>;
  peakHours: ReturnType<typeof usePeakHours>;
  customerMetrics: ReturnType<typeof useCustomerMetrics>;
  dailyRevenue: ReturnType<typeof useDailyRevenue>;
  zoneStats: ReturnType<typeof useZoneStats>;
  chartData: { label: string; value: number }[];
  chartTotal: number;
  exporting: boolean;
  exportError: string | null;
  handleExport: () => Promise<void>;
  topErrorMsg: string | null;
  peakErrorMsg: string | null;
  custErrorMsg: string | null;
  revErrorMsg: string | null;
  zoneErrorMsg: string | null;
}

/**
 * Aggregates all analytics query hooks and derived state for the dashboard.
 */
export function useDashboardAnalytics(
  t: (key: string) => string,
  period: Period = 'daily',
): DashboardAnalytics {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { from, to, days } = useMemo(() => getPeriodStoreDateRange(period), [period]);

  const topProducts = useTopProducts(10);
  const peakHours = usePeakHours(days);
  const customerMetrics = useCustomerMetrics();
  const dailyRevenue = useDailyRevenue(from, to);
  const zoneStats = useZoneStats(days);

  const chartData = (dailyRevenue.data || []).map((d) => ({
    label: d.date.slice(5),
    value: d.revenue,
  }));

  const chartTotal = (dailyRevenue.data || []).reduce((s, d) => s + d.revenue, 0);

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      await downloadAnalyticsCsv(from, to);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : t('exportError'));
    } finally {
      setExporting(false);
    }
  }, [exporting, from, to, t]);

  const topErrorMsg = topProducts.isError
    ? topProducts.error instanceof Error ? topProducts.error.message : t('topProductError')
    : null;
  const peakErrorMsg = peakHours.isError
    ? peakHours.error instanceof Error ? peakHours.error.message : t('peakHourError')
    : null;
  const custErrorMsg = customerMetrics.isError
    ? customerMetrics.error instanceof Error ? customerMetrics.error.message : t('customerMetricError')
    : null;
  const revErrorMsg = dailyRevenue.isError
    ? dailyRevenue.error instanceof Error ? dailyRevenue.error.message : t('revenueError')
    : null;
  const zoneErrorMsg = zoneStats.isError
    ? zoneStats.error instanceof Error ? zoneStats.error.message : t('zoneStatsError')
    : null;

  return {
    topProducts,
    peakHours,
    customerMetrics,
    dailyRevenue,
    zoneStats,
    chartData,
    chartTotal,
    exporting,
    exportError,
    handleExport,
    topErrorMsg,
    peakErrorMsg,
    custErrorMsg,
    revErrorMsg,
    zoneErrorMsg,
  };
}
