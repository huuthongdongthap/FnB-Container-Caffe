import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AuraImage } from '@/components/ui/AuraImage';
import type { Product, Category } from './types';

interface ProductListProps {
  products: Product[];
  categoriesById: Map<number, Category>;
  isLoading: boolean;
  isError: boolean;
  onRefetch: () => void;
  onEdit: (product: Product) => void;
  onDelete: (id: number) => void;
  onToggleAvailability: (product: Product) => void;
  onAdd: () => void;
  togglePending: boolean;
  toggleVariableId?: number | null;
}

function renderSkeletonRows(count = 5) {
  return Array.from({ length: count }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: 6 }).map((__, j) => (
        <td key={j} className="px-4 py-3">
          <Skeleton className={j === 5 ? 'h-8 w-20' : 'h-4 w-full'} />
        </td>
      ))}
    </tr>
  ));
}

export function ProductList({
  products,
  categoriesById,
  isLoading,
  isError,
  onRefetch,
  onEdit,
  onDelete,
  onToggleAvailability,
  onAdd,
  togglePending,
  toggleVariableId,
}: ProductListProps) {
  const { t } = useTranslation();
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">
          {isLoading ? t('common.loading') : t('adminMenu.productCount', { count: products.length })}
        </p>
        <Button onClick={onAdd}>{t('adminMenu.addProduct')}</Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/5">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('adminMenu.colName')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('adminMenu.colPrice')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('adminMenu.colCategory')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('adminMenu.colStatus')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted">{t('adminMenu.colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && renderSkeletonRows()}
              {!isLoading && isError && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-destructive">
                    {t('adminMenu.errorLoadingProducts')}{' '}
                    <button onClick={onRefetch} className="underline">{t('common.retry')}</button>
                  </td>
                </tr>
              )}
              {!isLoading && !isError && products.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">
                    {t('adminMenu.emptyProducts')}
                  </td>
                </tr>
              )}
              {!isLoading && !isError && products.map((p) => (
                <tr key={p.id} className="hover:bg-muted/5 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.image_url && <AuraImage src={p.image_url} alt={p.name} className="h-10 w-10 rounded object-cover" />}
                      <div>
                        <p className="font-medium text-sm">{p.name}</p>
                        {p.slug && <p className="text-xs text-muted">{p.slug}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {p.price ? Number(p.price).toLocaleString('vi-VN') : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {p.category_id ? categoriesById.get(p.category_id)?.name || `#${p.category_id}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={p.is_available ? 'success' : 'error'}>
                      {p.is_available ? t('adminMenu.available') : t('adminMenu.soldOut')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={togglePending && toggleVariableId === p.id}
                        onClick={() => onToggleAvailability(p)}
                        title={t('adminMenu.toggleAvailable')}
                      >
                        {togglePending && toggleVariableId === p.id ? '...' : p.is_available ? '✅' : '❌'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onEdit(p)}>
                        {t('adminMenu.editBtn')}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDelete(p.id)}>
                        {t('adminMenu.deleteBtn')}
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
