import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useAdminDashboardStore } from '@/hooks/stores/admin/use-admin-dashboard-store';
import { useAdminOrdersStore } from '@/hooks/stores/admin/use-admin-orders-store';
import { StuckPaymentsCard } from '@/components/admin/StuckPaymentsCard';
import { CustomerMetrics } from '@/components/admin/CustomerMetrics';
import { RevenueChart } from '@/components/admin/RevenueChart';
import { TopProductsChart } from '@/components/admin/TopProductsChart';
import { PeakHoursChart } from '@/components/admin/PeakHoursChart';
import { useAdmin } from '@/hooks/use-admin';
import { DASHBOARD_HELMET, type Period } from './Dashboard-constants';
import { useDashboardAnalytics } from './Dashboard-hooks';
import {
  StatsGrid,
  ZoneStatsSection,
  RecentOrdersSection,
  TopCustomersSection,
} from './Dashboard-sections';

export default function AdminDashboardPage() {
  const { stats, loading: statsLoading, error: statsError, fetchDashboard } = useAdminDashboardStore();
  const { orders, loading: ordersLoading, fetchOrders } = useAdminOrdersStore();
  const { customers, isLoadingCustomers } = useAdmin();
  const [period, setPeriod] = useState<Period>('daily');
  const { t } = useTranslation('admin');

  const {
    topProducts, peakHours, customerMetrics, dailyRevenue, zoneStats,
    chartData, chartTotal, exporting, handleExport,
    topErrorMsg, peakErrorMsg, custErrorMsg, revErrorMsg, zoneErrorMsg,
  } = useDashboardAnalytics(t);

  if (statsError) {
    return (
      <div className="min-h-screen bg-background p-6">
        <HelmetHead {...DASHBOARD_HELMET} />
        <div className="mx-auto max-w-7xl">
          <div className="rounded-xl border border-border bg-red-500/10 p-4 text-sm text-red-700">
            {statsError}
            <button onClick={() => fetchDashboard()} className="ml-3 underline hover:no-underline">
              {t('common:retry')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <HelmetHead {...DASHBOARD_HELMET} />
      <div className="mx-auto max-w-7xl">
        {/* Header with export button */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl font-bold text-foreground">{t('dashboard')}</h1>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-full border border-chrome-light text-chrome-light hover:bg-chrome-light/8 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {exporting ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t('exporting')}
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                {t('exportCsv')}
              </>
            )}
          </button>
        </div>

        <StuckPaymentsCard />
        <StatsGrid stats={stats} />

        <div className="mb-6">
          <CustomerMetrics
            data={customerMetrics.data ?? null}
            loading={customerMetrics.isLoading}
            error={custErrorMsg}
            onRetry={() => customerMetrics.refetch()}
          />
        </div>

        <div className="mb-6">
          <ZoneStatsSection
            zoneStats={zoneStats.data}
            loading={zoneStats.isLoading}
            error={zoneErrorMsg}
            onRetry={() => zoneStats.refetch()}
          />
        </div>

        <div className="mb-6">
          <RevenueChart
            data={chartData}
            total={chartTotal}
            loading={dailyRevenue.isLoading}
            error={revErrorMsg}
            onRetry={() => dailyRevenue.refetch()}
            period={period}
            onPeriodChange={setPeriod}
          />
        </div>

        <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TopProductsChart
            data={topProducts.data ?? []}
            loading={topProducts.isLoading}
            error={topErrorMsg}
            onRetry={() => topProducts.refetch()}
          />
          <PeakHoursChart
            data={peakHours.data ?? []}
            loading={peakHours.isLoading}
            error={peakErrorMsg}
            onRetry={() => peakHours.refetch()}
          />
        </div>

        <RecentOrdersSection orders={orders} loading={ordersLoading} />
        <TopCustomersSection customers={customers} loading={isLoadingCustomers} />
      </div>
    </div>
  );
}
