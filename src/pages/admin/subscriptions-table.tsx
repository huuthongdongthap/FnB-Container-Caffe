import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDate, statusColor, statusLabel } from './subscription-api';
import type { SubscriptionRecord } from './subscription-types';

interface SubscriptionsTableProps {
  subscriptions: SubscriptionRecord[];
  isLoading: boolean;
  isError: boolean;
  onRefetch: () => void;
  onCancel: (id: string) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function renderSkeletonRows(cols: number, rows = 5) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: cols }).map((__, j) => (
        <td key={j} className="px-4 py-3">
          <Skeleton className={j === cols - 1 ? 'h-8 w-20' : 'h-4 w-full'} />
        </td>
      ))}
    </tr>
  ));
}

export function SubscriptionsTable({
  subscriptions,
  isLoading,
  isError,
  onRefetch,
  onCancel,
  t,
}: SubscriptionsTableProps) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/5">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('colCustomer')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('colPlan')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('colContainer')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('colValue')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('colStatus')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('colPeriod')}</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && renderSkeletonRows(7)}

            {isError && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-sm text-destructive">{t('subsLoadError')}</p>
                    <Button size="sm" variant="secondary" onClick={onRefetch}>{t('subsRetry')}</Button>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading && !isError && subscriptions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted">
                  <p className="mb-2">{t('subsEmptyTitle')}</p>
                </td>
              </tr>
            )}

            {!isLoading && !isError && subscriptions.map((sub) => (
              <tr key={sub.id} className="hover:bg-muted/5 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-sm font-medium">{sub.customer_name}</p>
                  <p className="text-xs text-muted">{sub.customer_email || sub.customer_phone}</p>
                </td>
                <td className="px-4 py-3 text-sm">{sub.plan_name || sub.plan_slug || '—'}</td>
                <td className="px-4 py-3 text-sm text-muted">
                  {sub.container_number ? (
                    <span className="font-mono text-xs">{sub.container_number}</span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-sm font-medium">
                  {formatCurrency(sub.amount_vnd)}₫
                  <span className="text-xs text-muted">/{sub.billing_cycle === 'yearly' ? t('billingYearly') : sub.billing_cycle === 'quarterly' ? t('billingQuarterly') : t('billingMonthly')}</span>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusColor(sub.status)}>
                    {statusLabel(sub.status, t)}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm text-muted">
                  {formatDate(sub.current_period_end)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {sub.status === 'active' && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onCancel(sub.id)}
                      >
                        {t('cancelSub')}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
