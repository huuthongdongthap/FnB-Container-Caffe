import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMetricsStore } from '@/hooks/stores/admin/use-metrics-store';
import { MetricCards } from '@/components/admin/metric-cards';
import { RangeSelector } from '@/components/admin/range-selector';
import { RequestChart } from '@/components/admin/request-chart';
import { PerformanceSection } from '@/components/admin/performance-section';

/* ═══════════════════════════════════════════════════════════════════
   MetricsDashboardPage — /admin/metrics
   Shows observability dashboard: metric cards, range selector, chart.
   Auto-refreshes every 60s. Staff-only (ProtectedRoute in App.tsx).
   ═══════════════════════════════════════════════════════════════════ */

export default function MetricsDashboardPage() {
  const { t } = useTranslation();
  const fetchMetrics = useMetricsStore((s) => s.fetchMetrics);
  const data = useMetricsStore((s) => s.data);
  const loading = useMetricsStore((s) => s.loading);
  const error = useMetricsStore((s) => s.error);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 60_000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <h1 className="text-2xl font-display font-bold">{t('adminMetrics.title')}</h1>
          <RangeSelector />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-6">
            {error}
            <button
              onClick={fetchMetrics}
              className="ml-3 underline hover:no-underline"
            >
              {t('adminMetrics.retry')}
            </button>
          </div>
        )}

        <div className="mb-6">
          <MetricCards />
        </div>

        <div className="mb-6">
          <RequestChart />
        </div>

        <div className="mb-6">
          <PerformanceSection />
        </div>

        {loading && data && (
          <p className="text-xs text-muted text-center">{t('adminMetrics.refreshing')}</p>
        )}
      </div>
    </div>
  );
}
