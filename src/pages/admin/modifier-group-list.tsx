import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ModifierGroup } from './types';

interface ModifierGroupListProps {
  groups: ModifierGroup[];
  isLoading: boolean;
  isError: boolean;
  onRefetch: () => void;
  onAdd: () => void;
  onManageChoices: (group: ModifierGroup) => void;
  onDelete: (group: ModifierGroup) => void;
}

function renderSkeletonRows(count = 4) {
  return Array.from({ length: count }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: 3 }).map((__, j) => (
        <td key={j} className="px-4 py-3">
          <Skeleton className={j === 2 ? 'h-8 w-32 ml-auto' : 'h-4 w-full'} />
        </td>
      ))}
    </tr>
  ));
}

/**
 * Choices are deliberately not listed here — that would mean one query per group.
 * They surface in the manage-choices modal instead, so opening it is the only
 * place the per-group fetch happens.
 */
export function ModifierGroupList({
  groups,
  isLoading,
  isError,
  onRefetch,
  onAdd,
  onManageChoices,
  onDelete,
}: ModifierGroupListProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">
          {isLoading ? t('common.loading') : t('adminMenu.modifierGroupCount', { count: groups.length })}
        </p>
        <Button onClick={onAdd}>{t('adminMenu.addModifierGroup')}</Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/5">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('adminMenu.colName')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('adminMenu.colType')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted">{t('adminMenu.colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && renderSkeletonRows()}
              {!isLoading && isError && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-destructive">
                    {t('adminMenu.errorLoadingModifiers')}{' '}
                    <button onClick={onRefetch} className="underline">{t('common.retry')}</button>
                  </td>
                </tr>
              )}
              {!isLoading && !isError && groups.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-muted">
                    {t('adminMenu.emptyModifiers')}
                  </td>
                </tr>
              )}
              {!isLoading && !isError && groups.map((group) => {
                return (
                  <tr key={group.id} className="hover:bg-muted/5 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium">{group.name}</td>
                    <td className="px-4 py-3 text-sm text-muted">
                      {group.type === 'multiple' ? t('adminMenu.modifierTypeMultiple') : t('adminMenu.modifierTypeSingle')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => onManageChoices(group)}>
                          {t('adminMenu.manageChoices')}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDelete(group)}>
                          {t('adminMenu.deleteBtn')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
