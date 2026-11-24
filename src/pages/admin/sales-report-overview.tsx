import { StatsCard } from '@/components/admin/StatsCard';
import type { Period, RevenueOverview } from './sales-report-types';
import { DollarSign, TrendingUp, TrendingDown, Clock, BarChart3 } from 'lucide-react';

interface SalesReportOverviewProps {
  overview: RevenueOverview | null;
  isLoading: boolean;
  period?: Period;
  from?: string;
  to?: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function resolvePeriodLabels(
  period: Period | undefined,
  from: string | undefined,
  to: string | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): { currentTitle: string; previousTitle: string } {
  if (period === '7d') {
    return {
      currentTitle: t('salesReports.revenue7d', { defaultValue: 'Doanh thu 7 ngày qua' }),
      previousTitle: t('salesReports.prev7d', { defaultValue: '7 ngày trước đó' }),
    };
  }
  if (period === '30d') {
    return {
      currentTitle: t('salesReports.revenue30d', { defaultValue: 'Doanh thu 30 ngày qua' }),
      previousTitle: t('salesReports.prev30d', { defaultValue: '30 ngày trước đó' }),
    };
  }
  if (period === 'custom') {
    const suffix = from && to ? ` (${from.slice(5)} - ${to.slice(5)})` : '';
    return {
      currentTitle: t('salesReports.revenueCustom', {
        from,
        to,
        defaultValue: `Doanh thu kỳ chọn${suffix}`,
      }),
      previousTitle: t('salesReports.prevCustom', { defaultValue: 'Kỳ trước tương ứng' }),
    };
  }
  return {
    currentTitle: t('salesReports.revenueToday'),
    previousTitle: t('salesReports.yesterday'),
  };
}

export function SalesReportOverview({ overview, isLoading: _isLoading, period, from, to, t }: SalesReportOverviewProps) {
  if (!overview) return null;

  const { currentTitle, previousTitle } = resolvePeriodLabels(period, from, to, t);

  return (
    <div className="stagger-reveal mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatsCard
        title={currentTitle}
        value={overview.todayRevenue}
        type="revenue"
        icon={<DollarSign className="w-6 h-6 text-[var(--aura-primary)]" />}
        change={
          overview.yesterdayRevenue > 0
            ? {
                value: Math.abs(Math.round(overview.changePercent * 10) / 10),
                isPositive: overview.changePercent >= 0,
              }
            : undefined
        }
      />
      <StatsCard
        title={previousTitle}
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
  );
}
