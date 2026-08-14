import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderTable } from '@/components/admin/OrderTable';
import type { AdminOrder } from '@/hooks/use-admin';

interface RecentOrdersSectionProps {
  recentOrders: AdminOrder[];
  ordersLoading: boolean;
  dataError: string | null;
  t: (key: string, options?: Record<string, unknown>) => string;
}

export function RecentOrdersSection({
  recentOrders,
  ordersLoading,
  dataError,
  t,
}: RecentOrdersSectionProps) {
  return (
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
  );
}
