import { useState, useCallback } from 'react';
import {
  useTopProducts,
  usePeakHours,
  useCustomerMetrics,
  useDailyRevenue,
  useZoneStats,
  downloadAnalyticsCsv,
} from '@/hooks/use-analytics-data';

export interface DashboardAnalytics {
  topProducts: ReturnType<typeof useTopProducts>;
  peakHours: ReturnType<typeof usePeakHours>;
  customerMetrics: ReturnType<typeof useCustomerMetrics>;
  dailyRevenue: ReturnType<typeof useDailyRevenue>;
  zoneStats: ReturnType<typeof useZoneStats>;
  chartData: { label: string; value: number }[];
  chartTotal: number;
  exporting: boolean;
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
export function useDashboardAnalytics(t: (key: string) => string): DashboardAnalytics {
  const [exporting, setExporting] = useState(false);

  const topProducts = useTopProducts(10);
  const peakHours = usePeakHours(30);
  const customerMetrics = useCustomerMetrics();
  const dailyRevenue = useDailyRevenue();
  const zoneStats = useZoneStats(30);

  const chartData = (dailyRevenue.data || []).map((d) => ({
    label: d.date.slice(5),
    value: d.revenue,
  }));

  const chartTotal = (dailyRevenue.data || []).reduce((s, d) => s + d.revenue, 0);

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const end = new Date().toISOString().slice(0, 10);
      const start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      await downloadAnalyticsCsv(start, end);
    } catch {
      // CSV export failed silently
    } finally {
      setExporting(false);
    }
  }, [exporting]);

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
    handleExport,
    topErrorMsg,
    peakErrorMsg,
    custErrorMsg,
    revErrorMsg,
    zoneErrorMsg,
  };
}
