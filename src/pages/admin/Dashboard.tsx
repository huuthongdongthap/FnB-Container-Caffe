import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { Card } from '@/components/ui/card';
import { useAdminDashboardStore } from '@/hooks/stores/admin/use-admin-dashboard-store';
import { useAdminOrdersStore } from '@/hooks/stores/admin/use-admin-orders-store';
import { StatsCard } from '@/components/admin/StatsCard';
import { StuckPaymentsCard } from '@/components/admin/StuckPaymentsCard';
import { OrderTable } from '@/components/admin/OrderTable';
import { CustomerTable } from '@/components/admin/CustomerTable';
import { useAdmin } from '@/hooks/use-admin';
import {
  DollarSign,
  ClipboardList,
  Users,
  TrendingUp,
} from 'lucide-react';
import {
  useTopProducts,
  usePeakHours,
  useCustomerMetrics,
  useDailyRevenue,
  useZoneStats,
  downloadAnalyticsCsv,
} from '@/hooks/use-analytics-data';
import { CustomerMetrics } from '@/components/admin/CustomerMetrics';
import { RevenueChart } from '@/components/admin/RevenueChart';
import { TopProductsChart } from '@/components/admin/TopProductsChart';
import { PeakHoursChart } from '@/components/admin/PeakHoursChart';

export default function AdminDashboardPage() {
  const { stats, loading: statsLoading, error: statsError, fetchDashboard } = useAdminDashboardStore();
  const { orders, loading: ordersLoading, fetchOrders } = useAdminOrdersStore();
  const { customers, isLoadingCustomers } = useAdmin();
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [exporting, setExporting] = useState(false);
  const { t } = useTranslation('admin');

  // TanStack Query hooks for analytics data
  const {
    data: topProducts,
    isLoading: topLoading,
    isError: topIsError,
    error: topError,
    refetch: refetchTop,
  } = useTopProducts(10);

  const {
    data: peakHours,
    isLoading: peakLoading,
    isError: peakIsError,
    error: peakError,
    refetch: refetchPeak,
  } = usePeakHours(30);

  const {
    data: customerMetrics,
    isLoading: custLoading,
    isError: custIsError,
    error: custError,
    refetch: refetchCust,
  } = useCustomerMetrics();

  const {
    data: dailyRevenue,
    isLoading: revLoading,
    isError: revIsError,
    error: revError,
    refetch: refetchRev,
  } = useDailyRevenue();

  const {
    data: zoneStats,
    isLoading: zoneLoading,
    isError: zoneIsError,
    error: zoneError,
    refetch: refetchZone,
  } = useZoneStats(30);

  // Map daily revenue data to chart format
  const chartData = (dailyRevenue || []).map((d) => ({
    label: d.date.slice(5), // MM-DD
    value: d.revenue,
  }));

  const chartTotal = (dailyRevenue || []).reduce((s, d) => s + d.revenue, 0);

  // CSV export handler
  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const end = new Date().toISOString().slice(0, 10);
      const start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      await downloadAnalyticsCsv(start, end);
    } catch (err) {
      // CSV export failed silently — error logged via fetch response
    } finally {
      setExporting(false);
    }
  }, [exporting]);

  const topErrorMsg = topIsError ? (topError instanceof Error ? topError.message : t('topProductError')) : null;
  const peakErrorMsg = peakIsError ? (peakError instanceof Error ? peakError.message : t('peakHourError')) : null;
  const custErrorMsg = custIsError ? (custError instanceof Error ? custError.message : t('customerMetricError')) : null;
  const revErrorMsg = revIsError ? (revError instanceof Error ? revError.message : t('revenueError')) : null;
  const zoneErrorMsg = zoneIsError ? (zoneError instanceof Error ? zoneError.message : t('zoneStatsError')) : null;

  if (statsError) {
    return (
      <div className="min-h-screen bg-background p-6">
        <HelmetHead
          title="Admin Dashboard"
          description="AURA CAFE admin dashboard — revenue, orders, customers, and analytics"
        />
        <div className="mx-auto max-w-7xl">
          <div className="rounded-xl border border-border bg-red-500/10 p-4 text-sm text-red-700">
            {statsError}
            <button
              onClick={() => fetchDashboard()}
              className="ml-3 underline hover:no-underline"
            >
              {t('common:retry')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <HelmetHead
        title="Admin Dashboard"
        description="AURA CAFE admin dashboard — revenue, orders, customers, and analytics"
      />
      <div className="mx-auto max-w-7xl">
        {/* Header */}
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

        {/* Stuck Payments Alert (owner-only, hidden when clean) */}
        <div className="mb-6">
          <StuckPaymentsCard />
        </div>

        {/* Stats Cards — existing "today" metrics (keep for backward compat) */}
        <div className="stagger-reveal mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title={t('statsTodayRevenue')}
            value={stats?.todayRevenue ?? 0}
            type="revenue"
            icon={<DollarSign className="w-6 h-6 text-primary" />}
            change={stats ? { value: 12, isPositive: true } : undefined}
          />
          <StatsCard
            title={t('statsOrders')}
            value={stats?.todayOrders ?? 0}
            type="count"
            icon={<ClipboardList className="w-6 h-6 text-primary" />}
          />
          <StatsCard
            title={t('statsCustomers')}
            value={stats?.activeCustomers ?? 0}
            type="count"
            icon={<Users className="w-6 h-6 text-primary" />}
          />
          <StatsCard
            title={t('statsAvgOrderValue')}
            value={stats?.avgOrderValue ?? 0}
            type="revenue"
            icon={<TrendingUp className="w-6 h-6 text-primary" />}
          />
        </div>

        {/* Customer Metrics — 4 analytics stat cards */}
        <div className="mb-6">
          <CustomerMetrics
            data={customerMetrics ?? null}
            loading={custLoading}
            error={custErrorMsg}
            onRetry={() => refetchCust()}
          />
        </div>

        {/* Zone Stats */}
        <div className="mb-6">
          {zoneLoading ? (
            <div className="rounded-xl border border-border bg-surface/80 p-6 text-sm text-muted">{t('common:loading')}</div>
          ) : zoneErrorMsg ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {zoneErrorMsg}
              <button onClick={() => refetchZone()} className="ml-3 underline hover:no-underline">{t('common:retry')}</button>
            </div>
          ) : zoneStats && zoneStats.length > 0 ? (
            <div className="rounded-xl border border-border bg-surface/80 p-5">
              <h3 className="font-display text-base font-semibold mb-4">{t('zoneStatsTitle')}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {zoneStats.map((z) => (
                  <div key={z.label} className="rounded-lg border border-border/60 bg-background/60 p-3 text-center">
                    <div className="text-xs text-muted mb-1 truncate">{z.label}</div>
                    <div className="font-semibold text-sm text-foreground">
                      {z.value.toLocaleString('vi-VN')}đ
                    </div>
                    <div className="text-[11px] text-muted mt-0.5">{z.count} {t('orders')}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Revenue Chart */}
        <div className="mb-6">
          <RevenueChart
            data={chartData}
            total={chartTotal}
            loading={revLoading}
            error={revErrorMsg}
            onRetry={() => refetchRev()}
            period={period}
            onPeriodChange={setPeriod}
          />
        </div>

        {/* Two-column layout: Top Products + Peak Hours */}
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TopProductsChart
            data={topProducts ?? []}
            loading={topLoading}
            error={topErrorMsg}
            onRetry={() => refetchTop()}
          />
          <PeakHoursChart
            data={peakHours ?? []}
            loading={peakLoading}
            error={peakErrorMsg}
            onRetry={() => refetchPeak()}
          />
        </div>

        {/* Recent Orders */}
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">{t('recentOrders')}</h2>
            <span className="text-xs text-muted">
              {ordersLoading ? t('common:loading') : t('ordersCount', { count: orders.length })}
            </span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border bg-surface/80 shadow-sm backdrop-blur-sm transition-shadow duration-200 hover:shadow-lg">
            <OrderTable orders={orders.slice(0, 10)} sortBy="date" />
          </div>
        </div>

        {/* Top Customers */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">{t('topCustomers')}</h2>
            <span className="text-xs text-muted">
              {isLoadingCustomers ? t('common:loading') : t('customersCount', { count: customers.length })}
            </span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border bg-surface/80 shadow-sm backdrop-blur-sm transition-shadow duration-200 hover:shadow-lg">
            <CustomerTable customers={customers.slice(0, 5)} />
          </div>
        </div>
      </div>
    </div>
  );
}
