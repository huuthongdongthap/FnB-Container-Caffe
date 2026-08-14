'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { Card } from '@/components/ui/card';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { PeriodComparisonChart } from '@/components/admin/PeriodComparisonChart';
import { GroupedSalesChart } from '@/components/admin/GroupedSalesChart';
import { useAdminOrdersStore } from '@/hooks/stores/admin/use-admin-orders-store';
import { useAdminDashboardStore } from '@/hooks/stores/admin/use-admin-dashboard-store';
import { useTranslation } from 'react-i18next';
import { FileDown } from 'lucide-react';
import type { Period, GroupBy, RevenueOverview, PeriodDataPoint } from './sales-report-types';
import { periodDates } from './date-helpers';
import {
  useDailyReportData,
  useSalesGrouped,
  useComparisonData,
  useExportCsv,
  CSV_EXPORT_ERR,
} from './use-sales-report-data';
import { RevenueCardsSkeleton } from './revenue-cards-skeleton';
import { SalesReportControls } from './sales-report-controls';
import { SalesReportOverview } from './sales-report-overview';
import { RecentOrdersSection } from './recent-orders-section';

const COMPARISON_ERROR_KEY = '__COMPARISON_ERR__';

export default function SalesReportsPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>('24h');
  const [compareMode, setCompareMode] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy | null>(null);

  const from = period === '24h' ? new Date().toISOString().slice(0, 10) : customStart || '2026-08-14';
  const to = period === '24h' ? new Date().toISOString().slice(0, 10) : customEnd || '2026-08-14';

  const overviewQ = useQuery<{ success: boolean; data: RevenueOverview }>({
    queryKey: ['admin-dashboard-overview', from, to],
    queryFn: () => apiFetch(`/api/dashboard/overview?from=${from}&to=${to}`),
    staleTime: 60_000,
  });

  const dailyQ = useDailyReportData(from, to);
  const comparison = useComparisonData(from, to);
  const groupedQ = useSalesGrouped(groupBy || 'day', from, to);

  const { orders: recentOrders, loading: ordersLoading } = useAdminOrdersStore();
  const { error: dataError, fetchDashboard } = useAdminDashboardStore();
  const { exportCsv, exporting, error: csvError } = useExportCsv(from, to);

  const overview = overviewQ.data?.data ?? null;
  const isLoading = overviewQ.isLoading || dailyQ.isLoading;

  return (
    <>
      <HelmetHead
        title="Reports — AURA CAFE"
        description="Revenue reports, analytics, and performance metrics for AURA CAFE."
      />
      <div className="min-h-screen bg-[var(--aura-bg-base)] p-6">
        <div className="mx-auto max-w-[1400px] space-y-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-display text-2xl font-bold text-foreground">
              {t('salesReports.title')}
            </h1>
            <button
              onClick={exportCsv}
              disabled={exporting}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wider transition-all duration-300 bg-[var(--aura-noir-deep)] text-[var(--aura-chrome-light)] hover:scale-[1.02] hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileDown className="w-3.5 h-3.5" />
              {exporting ? t('salesReports.exporting') : t('salesReports.exportCsv')}
            </button>
          </div>

          {csvError && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400 mb-6">
              {csvError === CSV_EXPORT_ERR ? t('salesReports.csvExportError') : csvError}
            </div>
          )}

          <SalesReportControls
            period={period}
            customStart={customStart}
            customEnd={customEnd}
            compareMode={compareMode}
            groupBy={groupBy}
            from={from}
            to={to}
            onPeriodChange={setPeriod}
            onCustomStartChange={setCustomStart}
            onCustomEndChange={setCustomEnd}
            onCompareModeToggle={() => setCompareMode((m) => !m)}
            onGroupByToggle={(g) => setGroupBy((prev) => (prev === g ? null : g))}
            t={t}
          />

          {isLoading && <RevenueCardsSkeleton />}

          <SalesReportOverview overview={overview} isLoading={isLoading} t={t} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-6">
            <PeriodComparisonChart
              data={comparison.data ? { current: comparison.data.current, previous: comparison.data.previous } : null}
              loading={comparison.loading}
              error={comparison.error === COMPARISON_ERROR_KEY ? 'Failed to load comparison data' : null}
              onRetry={comparison.refetch}
            />
            <GroupedSalesChart
              data={groupedQ.data?.data ?? null}
              groupBy={groupBy || 'day'}
              loading={groupedQ.isLoading}
              error={groupedQ.error ? 'Failed to load grouped data' : null}
              onRetry={() => groupedQ.refetch()}
            />
          </div>

          {dataError && (
            <Card className="mb-6 p-4 text-sm text-red-500">
              {dataError}{' '}
              <button onClick={fetchDashboard} className="underline">
                {t('salesReports.retry')}
              </button>
            </Card>
          )}

          <RecentOrdersSection
            recentOrders={recentOrders}
            ordersLoading={ordersLoading}
            dataError={dataError}
            t={t}
          />
        </div>
      </div>
    </>
  );
}
