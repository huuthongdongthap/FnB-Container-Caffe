import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDate } from './use-promotions-manager';
import type { Promotion } from './types';

interface PromotionsListProps {
  promotions: Promotion[];
  isLoading: boolean;
  isError: boolean;
  onRefetch: () => void;
  onEdit: (promo: Promotion) => void;
  onDelete: (code: string) => void;
  onAdd: () => void;
}

function renderSkeletonRows(count = 5) {
  return Array.from({ length: count }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: 7 }).map((__, j) => (
        <td key={j} className="px-4 py-3">
          <Skeleton className={j === 6 ? 'h-8 w-20' : 'h-4 w-full'} />
        </td>
      ))}
    </tr>
  ));
}

export function PromotionsList({
  promotions,
  isLoading,
  isError,
  onRefetch,
  onEdit,
  onDelete,
  onAdd,
}: PromotionsListProps) {
  const { t } = useTranslation('adminPromotions');

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">
          {isLoading ? t('loading') : t('count', { count: promotions.length })}
        </p>
        <Button onClick={onAdd}>{t('addPromotion')}</Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/5">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('colCode')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('colDiscount')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('colLimit')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('colDate')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('colUsed')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('colStatus')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && renderSkeletonRows()}

              {isError && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <p className="text-sm text-destructive">{t('loadError')}</p>
                      <Button size="sm" variant="secondary" onClick={onRefetch}>
                        {t('retry')}
                      </Button>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && !isError && promotions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted">
                    <p className="mb-2">{t('emptyTitle')}</p>
                    <Button size="sm" variant="secondary" onClick={onAdd}>
                      {t('createFirst')}
                    </Button>
                  </td>
                </tr>
              )}

              {!isLoading && !isError && promotions.map((promo) => (
                <tr key={promo.code} className="hover:bg-muted/5 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-semibold">{promo.code}</span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {promo.percent}%
                    {promo.max_discount > 0 && (
                      <span className="text-xs text-muted ml-1">
                        {t('maxDiscount', { value: formatCurrency(promo.max_discount) })}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">
                    {promo.min_order > 0 ? t('minOrderCondition', { value: formatCurrency(promo.min_order) }) : t('noMinOrder')}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">
                    {formatDate(promo.starts_at)} — {formatDate(promo.expires_at)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {promo.usage_count}/{promo.usage_limit || '∞'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={promo.is_active ? 'success' : 'destructive'}>
                      {promo.is_active ? t('labelActive') : t('labelInactive')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => onEdit(promo)}>
                        {t('edit')}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => onDelete(promo.code)}>
                        {t('delete')}
                      </Button>
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
