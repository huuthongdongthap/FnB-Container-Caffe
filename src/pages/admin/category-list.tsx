import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Category } from './types';

interface CategoryListProps {
  categories: Category[];
  isLoading: boolean;
  isError: boolean;
  onRefetch: () => void;
  onEdit: (category: Category) => void;
  onDelete: (id: number) => void;
  onAdd: () => void;
}

function renderSkeletonRows(count = 4) {
  return Array.from({ length: count }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: 4 }).map((__, j) => (
        <td key={j} className="px-4 py-3">
          <Skeleton className={j === 3 ? 'h-8 w-20 ml-auto' : 'h-4 w-full'} />
        </td>
      ))}
    </tr>
  ));
}

export function CategoryList({
  categories,
  isLoading,
  isError,
  onRefetch,
  onEdit,
  onDelete,
  onAdd,
}: CategoryListProps) {
  const { t } = useTranslation();
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">
          {isLoading ? t('common.loading') : t('adminMenu.categoryCount', { count: categories.length })}
        </p>
        <Button onClick={onAdd}>{t('adminMenu.addCategory')}</Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/5">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('adminMenu.colName')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('adminMenu.colSlug')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('adminMenu.colSort')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted">{t('adminMenu.colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && renderSkeletonRows()}
              {!isLoading && isError && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-destructive">
                    {t('adminMenu.errorLoadingCategories')}{' '}
                    <button onClick={onRefetch} className="underline">{t('common.retry')}</button>
                  </td>
                </tr>
              )}
              {!isLoading && !isError && categories.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted">
                    {t('adminMenu.emptyCategories')}
                  </td>
                </tr>
              )}
              {!isLoading && !isError && categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-muted/5 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium">{cat.name}</td>
                  <td className="px-4 py-3 text-sm text-muted">{cat.slug || '—'}</td>
                  <td className="px-4 py-3 text-sm">{cat.sort_order ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => onEdit(cat)}>
                        {t('adminMenu.editBtn')}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDelete(cat.id)}>
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
