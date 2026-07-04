'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, API_BASE } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatsCard } from '@/components/admin/StatsCard';
import { PeriodComparisonChart } from '@/components/admin/PeriodComparisonChart';
import { GroupedSalesChart } from '@/components/admin/GroupedSalesChart';
import type { GroupedSalesData } from '@/components/admin/GroupedSalesChart';
import { DateRangePicker } from '@/components/admin/DateRangePicker';
import { OrderTable } from '@/components/admin/OrderTable';
import { useAdminOrdersStore } from '@/hooks/stores/admin/use-admin-orders-store';
import { useAdminDashboardStore } from '@/hooks/stores/admin/use-admin-dashboard-store';
import { useTranslations } from 'next-intl';
import { HelmetHead } from '@/components/seo/HelmetHead';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  Calendar,
  Filter,
  FileDown,
  BarChart3,
} from 'lucide-react';

/* ─── Sentinels for hook error keys ─── */

const COMPARISON_ERROR_KEY = '__COMPARISON_ERR__';

/* ─── Types for page-level queries ─── */

interface RevenueOverview {
  todayRevenue: number;
  yesterdayRevenue: number;
  changePercent: number;
  todayOrders: number;
  yesterdayOrders: number;
  avgOrderValue: number;
}

interface PeriodDataPoint {
  date: string;
  revenue: number;
}

/* ─── Date helpers ─── */

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

function periodDates(
  period: '24h' | '7d' | '30d',
  customStart: string,
  customEnd: string,
): { from: string; to: string } {
  const now = todayStr();
  switch (period) {
    case '24h':
      return { from: now, to: now };
    case '7d':
      return { from: daysAgo(6), to: now };
    case '30d':
      return { from: daysAgo(29), to: now };
    default:
      return {
        from: customStart || daysAgo(6),
        to: customEnd || now,
      };
  }
}

function previousPeriodDates(from: string, to: string): { from: string; to: string } {
  const rangeMs =
    new Date(to).getTime() - new Date(from).getTime();
  const shiftMs = rangeMs + 86400000;
  return {
    from: new Date(new Date(from).getTime() - shiftMs).toISOString().slice(0, 10),
    to: new Date(new Date(to).getTime() - shiftMs).toISOString().slice(0, 10),
  };
}

/* ─── Custom hooks for sales report data ─── */

function useDailyReportData(from: string, to: string) {
  return useQuery<{ success: boolean; data: PeriodDataPoint[] }>({
    queryKey: ['reports', 'daily', from, to],
    queryFn: () =>
      apiFetch(`/api/reports/daily?from=${from}&to=${to}`),
    enabled: !!from && !!to,
    staleTime: 60_000,
  });
}

function useSalesGrouped(
  groupBy: 'hour' | 'day' | 'category' | 'payment',
  from: string,
  to: string,
) {
  const endpointMap: Record<string, string> = {
    hour: '/api/reports/sales-by-hour',
    day: '/api/reports/sales-by-day',
    category: '/api/reports/sales-by-category',
    payment: '/api/reports/sales-by-payment',
  };

  return useQuery<{ success: boolean; data: GroupedSalesData }>({
    queryKey: ['reports', 'sales-grouped', groupBy, from, to],
    queryFn: () =>
      apiFetch(`${endpointMap[groupBy]}?from=${from}&to=${to}`),
    enabled: !!from && !!to,
    staleTime: 60_000,
  });
}

const CSV_EXPORT_ERR_KEY = '__CSV_EXPORT_ERR__';

function useComparisonData(from: string, to: string) {
  const prev = previousPeriodDates(from, to);

  const currentQ = useDailyReportData(from, to);
  const previousQ = useDailyReportData(prev.from, prev.to);

  return {
    data:
      currentQ.data?.data && previousQ.data?.data
        ? {
            current: currentQ.data.data,
            previous: previousQ.data.data,
          }
        : null,
    loading: currentQ.isLoading || previousQ.isLoading,
    error:
      currentQ.error || previousQ.error
        ? COMPARISON_ERROR_KEY
        : null,
    refetch: () => {
      currentQ.refetch();
      previousQ.refetch();
    },
  };
}

/* ─── CSV Export ─── */

function useExportCsv(from: string, to: string) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportCsv = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    setError(null);
    try {
      let token: string | null = null;
      try {
        const { useAuthStore } = await import('@/hooks/stores/use-auth-store');
        token = useAuthStore.getState().token;
      } catch { /* store not available */ }

      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(
        `${API_BASE}/api/reports/export?from=${from}&to=${to}&type=sales`,
        { headers },
      );

      if (!res.ok) {
        throw new Error(`Export failed: ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sales-report-${from}-to-${to}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : CSV_EXPORT_ERR_KEY);
    } finally {
      setExporting(false);
    }
  }, [from, to, exporting]);

  return { exportCsv, exporting, error };
}

/* ─── Skeleton for revenue cards ─── */

function RevenueCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="p-4">
          <Skeleton className="h-3 w-24 mb-2" />
          <Skeleton className="h-7 w-28 mb-2" />
          <Skeleton className="h-3 w-16" />
        </Card>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SalesReportsPage — /admin/sales-reports
   ═══════════════════════════════════════════════════════════════════ */

export default function SalesReportsPage() {
  const t = useTranslations();

  /* ─── Local state ─── */

  const [period, setPeriod] = useState<'24h' | '7d' | '30d' | 'custom'>('30d');
  const [customStart, setCustomStart] = useState(daysAgo(29));
  const [customEnd, setCustomEnd] = useState(todayStr());
  const [compareMode, setCompareMode] = useState(false);
  const [groupBy, setGroupBy] = useState<'hour' | 'day' | 'category' | 'payment' | null>(null);

  /* ─── Derived dates ─── */

  const { from, to } = useMemo(
    () =>
      period === 'custom'
        ? { from: customStart, to: customEnd }
        : periodDates(period, customStart, customEnd),
    [period, customStart, customEnd],
  );

  const isCustom = period === 'custom';

  /* ─── Stores ─── */

  const { stats, loading: statsLoading, error: statsError, fetchDashboard } = useAdminDashboardStore();
  const { orders, loading: ordersLoading, fetchOrders } = useAdminOrdersStore();

  /* ─── Queries ─── */

  const {
    data: dailyRaw,
    isLoading: dailyLoading,
    isError: dailyIsError,
    error: dailyError,
    refetch: refetchDaily,
  } = useDailyReportData(from, to);

  const {
    data: comparison,
    loading: comparisonLoading,
    error: comparisonError,
    refetch: refetchComparison,
  } = useComparisonData(from, to);

  const {
    data: groupedRaw,
    isLoading: groupedLoading,
    isError: groupedIsError,
    error: groupedError,
    refetch: refetchGrouped,
  } = useSalesGrouped(groupBy ?? 'day', from, to);

  const { exportCsv, exporting, error: csvError } = useExportCsv(from, to);

  /* ─── Derived revenue overview ─── */

  const overview = useMemo((): RevenueOverview | null => {
    if (!dailyRaw?.data || dailyRaw.data.length === 0) return null;

    // The data is ordered by date ascending; last entry is latest
    const todayEntry = dailyRaw.data[dailyRaw.data.length - 1];
    const yesterdayEntry = dailyRaw.data.length > 1
      ? dailyRaw.data[dailyRaw.data.length - 2]
      : null;

    const totalRevenue = dailyRaw.data.reduce((s, d) => s + d.revenue, 0);
    const totalOrders = dailyRaw.data.reduce((s, d) => s + (Number((d as unknown as Record<string, unknown>).orders) || 0), 0);

    // For "today" show either a dedicated field or the most recent date's data
    const todayRev = todayEntry?.revenue ?? 0;
    const yesterdayRev = yesterdayEntry?.revenue ?? 0;
    const changePercent =
      yesterdayRev > 0
        ? ((todayRev - yesterdayRev) / yesterdayRev) * 100
        : todayRev > 0
          ? 100
          : 0;

    return {
      todayRevenue: todayRev,
      yesterdayRevenue: yesterdayRev,
      changePercent,
      todayOrders: Number((todayEntry as unknown as Record<string, unknown>)?.orders) || 0,
      yesterdayOrders: Number((yesterdayEntry as unknown as Record<string, unknown>)?.orders) || 0,
      avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    };
  }, [dailyRaw]);

  const isLoading = statsLoading || (dailyLoading && !dailyRaw);
  const dataError = statsError || (dailyIsError ? (dailyError instanceof Error ? dailyError.message : t('salesReports.dataError')) : null);

  /* ─── Recent orders ─── */

  const recentOrders = useMemo(() => {
    if (!orders) return [];
    return [...orders]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 10);
  }, [orders]);

  // Fetch data on mount
  useEffect(() => {
    fetchDashboard();
    fetchOrders();
  }, [fetchDashboard, fetchOrders]);

  /* ─── Period button styles ─── */

  const periodBtn = (p: typeof period) =>
    cn(
      'px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-full transition-all duration-300',
      period === p
        ? 'bg-[var(--aura-chrome-light)] text-[var(--aura-noir-deep)]'
        : 'border border-[var(--aura-chrome-light)] text-[var(--aura-chrome-light)] hover:bg-[rgba(201,214,223,0.08)]',
    );

  /* ─── Group by button styles ─── */

  const groupBtn = (g: NonNullable<typeof groupBy>) =>
    cn(
      'px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider rounded-full transition-all duration-300',
      groupBy === g
        ? 'bg-[var(--aura-chrome-light)] text-[var(--aura-noir-deep)]'
        : 'border border-[var(--aura-chrome-light)]/40 text-[var(--aura-chrome-light)]/60 hover:bg-[rgba(201,214,223,0.08)]',
    );

  return (
    <>
      <HelmetHead
        title="Báo cáo doanh thu — Sales Reports — AURA CAFE"
        description="Xem báo cáo doanh thu, thống kê bán hàng và phân tích xu hướng tại AURA CAFE. Sales reports, revenue statistics & trend analysis."
      />
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-7xl">
          {/* ═══ Header ═══ */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">
                {t('salesReports.title')}
            </h1>
            <p className="text-sm text-[var(--aura-text-muted)] mt-1">
              {t('salesReports.subtitle')}
            </p>
          </div>

          {/* Export CSV button */}
          <button
            onClick={exportCsv}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider
              rounded-full border border-[var(--aura-chrome-light)] text-[var(--aura-chrome-light)]
              hover:bg-[rgba(201,214,223,0.08)] transition-all duration-300
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {exporting ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t('salesReports.exporting')}
              </>
            ) : (
              <>
                <FileDown className="w-3.5 h-3.5" />
                {t('salesReports.exportCsv')}
              </>
            )}
          </button>
        </div>

        {/* CSV export error */}
        {csvError && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            {csvError === CSV_EXPORT_ERR_KEY ? t('salesReports.csvExportError') : csvError}
          </div>
        )}

        {/* ═══ Controls ═══ */}
        <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] p-4 mb-6">
          {/* Row 1: Period + Compare + Group By */}
          <div className="flex flex-wrap items-center gap-3 mb-3">
            {/* Period selector */}
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[var(--aura-chrome-light)]" />
              {(['24h', '7d', '30d', 'custom'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={periodBtn(p)}
                >
                  {p === '24h' ? '24h' : p === '7d' ? t('salesReports.period.7d') : p === '30d' ? t('salesReports.period.30d') : t('salesReports.period.custom')}
                </button>
              ))}
            </div>

            {/* Divider */}
            <span className="hidden md:inline w-px h-6 bg-[var(--glass-border)]" />

            {/* Compare mode toggle */}
            <button
              onClick={() => setCompareMode(!compareMode)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider rounded-full transition-all duration-300',
                compareMode
                  ? 'bg-[var(--aura-chrome-light)] text-[var(--aura-noir-deep)]'
                  : 'border border-[var(--aura-chrome-light)]/40 text-[var(--aura-chrome-light)]/60 hover:bg-[rgba(201,214,223,0.08)]',
              )}
            >
              <BarChart3 className="w-3 h-3" />
              {t('salesReports.compareMode')}
            </button>

            {/* Divider */}
            <span className="hidden md:inline w-px h-6 bg-[var(--glass-border)]" />

            {/* Group by selector */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-[var(--aura-chrome-light)]" />
              {(['hour', 'day', 'category', 'payment'] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGroupBy(groupBy === g ? null : g)}
                  className={groupBtn(g)}
                >
                  {g === 'hour' ? t('salesReports.groupBy.hour') : g === 'day' ? t('salesReports.groupBy.day') : g === 'category' ? t('salesReports.groupBy.category') : t('salesReports.groupBy.payment')}
                </button>
              ))}
            </div>
          </div>

          {/* Row 2: Custom date range (shown only when "custom" selected) */}
          {isCustom && (
            <div className="mt-3 pt-3 border-t border-[var(--glass-border)]">
              <DateRangePicker
                startDate={customStart}
                endDate={customEnd}
                onStartDateChange={setCustomStart}
                onEndDateChange={setCustomEnd}
              />
            </div>
          )}

          {/* Period summary subtitle */}
          <div className="mt-3 text-[11px] text-[var(--aura-text-muted)] font-mono">
            {from === to
              ? t('salesReports.periodSummary.today', { from })
              : t('salesReports.periodSummary.range', {
                  from,
                  to,
                  days: Math.round(
                    (new Date(to).getTime() - new Date(from).getTime()) / 86400000 + 1,
                  ),
                })}
            {compareMode && (
              <span className="ml-2 opacity-60">
                {t('salesReports.periodSummary.compare', {
                  prevFrom: previousPeriodDates(from, to).from,
                  prevTo: previousPeriodDates(from, to).to,
                })}
              </span>
            )}
          </div>
        </div>

        {/* ═══ Error state ═══ */}
        {dataError && (
          <div className="mb-6 rounded-xl border border-border bg-red-500/10 p-4 text-sm text-red-700">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <span>{t('salesReports.dataError')}</span>
              <button
                onClick={() => {
                  fetchDashboard();
                  refetchDaily();
                }}
                className="ml-2 underline hover:no-underline text-red-600"
              >
                {t('salesReports.retry')}
              </button>
            </div>
          </div>
        )}

        {/* ═══ Revenue Overview Cards ═══ */}
        {isLoading && !overview ? (
          <RevenueCardsSkeleton />
        ) : overview ? (
          <div className="stagger-reveal mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title={t('salesReports.revenueToday')}
              value={overview.todayRevenue}
              type="revenue"
              icon={<DollarSign className="w-6 h-6 text-[var(--aura-primary)]" />}
              change={{
                value: Math.abs(Math.round(overview.changePercent * 10) / 10),
                isPositive: overview.changePercent >= 0,
              }}
            />
            <StatsCard
              title={t('salesReports.yesterday')}
              value={overview.yesterdayRevenue}
              type="revenue"
              icon={
                overview.changePercent >= 0 ? (
                  <TrendingUp className="w-6 h-6 text-green-400" />
                ) : (
                  <TrendingDown className="w-6 h-6 text-red-400" />
                )
              }
            />
            <StatsCard
              title={t('salesReports.ordersLabel')}
              value={overview.todayOrders}
              type="count"
              icon={<Clock className="w-6 h-6 text-[var(--aura-primary)]" />}
            />
            <StatsCard
              title={t('salesReports.avgOrderValue')}
              value={Math.round(overview.avgOrderValue)}
              type="revenue"
              icon={<BarChart3 className="w-6 h-6 text-[var(--aura-primary)]" />}
            />
          </div>
        ) : (
          /* Empty state */
          <div className="mb-6 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] p-8">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <svg className="w-12 h-12 text-[var(--aura-text-muted)] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              <p className="text-base font-medium text-[var(--aura-text-body)] mb-1">
                {t('salesReports.empty.noData')}
              </p>
              <p className="text-sm text-[var(--aura-text-muted)]">
                {t('salesReports.empty.noDataDescription')}
              </p>
            </div>
          </div>
        )}

        {/* ═══ Two-column layout: Comparison Chart + Grouped Sales ═══ */}
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Period Comparison Chart */}
          {compareMode && (
            <PeriodComparisonChart
              data={comparison}
              loading={comparisonLoading}
              error={comparisonError === COMPARISON_ERROR_KEY ? t('salesReports.comparisonError') : comparisonError}
              onRetry={refetchComparison}
            />
          )}

          {/* Grouped Sales Chart */}
          {groupBy && (
            <GroupedSalesChart
              data={groupedRaw?.data ?? null}
              groupBy={groupBy}
              loading={groupedLoading}
              error={groupedIsError ? (groupedError instanceof Error ? groupedError.message : t('salesReports.groupedError')) : null}
              onRetry={refetchGrouped}
            />
          )}
        </div>

        {/* ═══ Recent Orders ═══ */}
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-foreground">
              {t('salesReports.recentOrders')}
            </h2>
            <span className="text-xs text-[var(--aura-text-muted)]">
              {ordersLoading ? t('salesReports.loading') : t('salesReports.orderCount', { count: recentOrders.length })}
            </span>
          </div>

          {ordersLoading && recentOrders.length === 0 ? (
            <Card className="p-4">
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-24 flex-1" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            </Card>
          ) : recentOrders.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)]/80 shadow-sm backdrop-blur-sm transition-shadow duration-200 hover:shadow-lg">
              <OrderTable orders={recentOrders} sortBy="date" />
            </div>
          ) : !dataError ? (
            <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] p-6">
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <svg className="w-10 h-10 text-[var(--aura-text-muted)] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
                <p className="text-sm text-[var(--aura-text-muted)]">{t('salesReports.empty.noOrders')}</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
    </>
  );
}
