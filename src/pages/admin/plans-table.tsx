import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from './subscription-api';
import type { PlanRecord } from './subscription-types';

interface PlansTableProps {
  plans: PlanRecord[];
  isLoading: boolean;
  isError: boolean;
  onRefetch: () => void;
  onEdit: (plan: PlanRecord) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
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

export function PlansTable({
  plans,
  isLoading,
  isError,
  onRefetch,
  onEdit,
  onDelete,
  onAdd,
  t,
}: PlansTableProps) {
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">
          {isLoading ? t('plansLoading') : t('plansCount', { count: plans.length })}
        </p>
        <Button onClick={onAdd}>{t('addPlan')}</Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/5">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('colPlanName')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('colPrice')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('colContainer')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('colDeposit')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('colPopular')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('colPlanStatus')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted">{t('colPlanActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && renderSkeletonRows(7)}

              {isError && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <p className="text-sm text-destructive">{t('plansLoadError')}</p>
                      <Button size="sm" variant="secondary" onClick={onRefetch}>{t('plansRetry')}</Button>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && !isError && plans.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted">
                    <p className="mb-2">{t('plansEmptyTitle')}</p>
                    <Button size="sm" variant="secondary" onClick={onAdd}>{t('createFirstPlan')}</Button>
                  </td>
                </tr>
              )}

              {!isLoading && !isError && plans.map((plan) => (
                <tr key={plan.id} className="hover:bg-muted/5 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold">{plan.name}</p>
                    <p className="text-xs text-muted">{plan.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {formatCurrency(plan.monthly_price_vnd)}₫
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">
                    {plan.container_size}
                    {plan.max_occupants > 0 ? t('occupants', { count: plan.max_occupants }) : ''}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">
                    {plan.deposit_vnd > 0 ? formatCurrency(plan.deposit_vnd) + '₫' : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={plan.is_popular ? 'success' : 'default'}>
                      {plan.is_popular ? 'Popular' : '—'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={plan.is_active ? 'success' : 'destructive'}>
                      {plan.is_active ? t('planActiveLabel') : t('planInactiveLabel')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => onEdit(plan)}>{t('editPlan')}</Button>
                      <Button size="sm" variant="destructive" onClick={() => onDelete(plan.id)}>{t('deletePlan')}</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
