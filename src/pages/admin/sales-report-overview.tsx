import { StatsCard } from '@/components/admin/StatsCard';
import type { RevenueOverview } from './sales-report-types';
import { DollarSign, TrendingUp, TrendingDown, Clock, BarChart3 } from 'lucide-react';

interface SalesReportOverviewProps {
  overview: RevenueOverview | null;
  isLoading: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}

export function SalesReportOverview({ overview, isLoading, t }: SalesReportOverviewProps) {
  if (!overview) return null;

  return (
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
  );
}
