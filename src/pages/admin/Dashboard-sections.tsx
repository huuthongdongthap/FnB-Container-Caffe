import { useTranslation } from 'react-i18next';
import {
  DollarSign,
  ClipboardList,
  Users,
  TrendingUp,
} from 'lucide-react';
import { StatsCard } from '@/components/admin/StatsCard';
import { OrderTable } from '@/components/admin/OrderTable';
import { CustomerTable } from '@/components/admin/CustomerTable';
import type { AdminStats, AdminOrder, AdminCustomer } from '@/hooks/use-admin';
import { STATS_CARDS } from './Dashboard-constants';

const ICON_MAP: Record<string, React.ReactNode> = {
  DollarSign: <DollarSign className="w-6 h-6 text-primary" />,
  ClipboardList: <ClipboardList className="w-6 h-6 text-primary" />,
  Users: <Users className="w-6 h-6 text-primary" />,
  TrendingUp: <TrendingUp className="w-6 h-6 text-primary" />,
};

interface StatsGridProps {
  stats: AdminStats | null | undefined;
}

export function StatsGrid({ stats }: StatsGridProps) {
  const { t } = useTranslation('admin');
  return (
    <div className="stagger-reveal mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {STATS_CARDS.map((card) => (
        <StatsCard
          key={card.key}
          title={t(card.translationKey)}
          value={stats?.[card.valueKey] ?? 0}
          type={card.type}
          icon={ICON_MAP[card.iconName]}
          change={card.key === 'revenue' && stats ? { value: 12, isPositive: true } : undefined}
        />
      ))}
    </div>
  );
}

interface ZoneStatsSectionProps {
  zoneStats: Array<{ label: string; value: number; count: number }> | undefined;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function ZoneStatsSection({ zoneStats, loading, error, onRetry }: ZoneStatsSectionProps) {
  const { t } = useTranslation('admin');

  if (loading) {
    return <div className="rounded-xl border border-border bg-surface/80 p-6 text-sm text-muted">{t('common:loading')}</div>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
        <button onClick={onRetry} className="ml-3 underline hover:no-underline">{t('common:retry')}</button>
      </div>
    );
  }

  if (!zoneStats || zoneStats.length === 0) return null;

  return (
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
  );
}

interface RecentOrdersSectionProps {
  orders: AdminOrder[];
  loading: boolean;
}

export function RecentOrdersSection({ orders, loading }: RecentOrdersSectionProps) {
  const { t } = useTranslation('admin');
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">{t('recentOrders')}</h2>
        <span className="text-xs text-muted">
          {loading ? t('common:loading') : t('ordersCount', { count: orders.length })}
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface/80 shadow-sm backdrop-blur-sm transition-shadow duration-200 hover:shadow-lg">
        <OrderTable orders={orders.slice(0, 10)} sortBy="date" />
      </div>
    </div>
  );
}

interface TopCustomersSectionProps {
  customers: AdminCustomer[];
  loading: boolean;
}

export function TopCustomersSection({ customers, loading }: TopCustomersSectionProps) {
  const { t } = useTranslation('admin');
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">{t('topCustomers')}</h2>
        <span className="text-xs text-muted">
          {loading ? t('common:loading') : t('customersCount', { count: customers.length })}
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface/80 shadow-sm backdrop-blur-sm transition-shadow duration-200 hover:shadow-lg">
        <CustomerTable customers={customers.slice(0, 5)} />
      </div>
    </div>
  );
}
