import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { ModifierGroup, ProductModifierLink } from './types';

interface ModifierLinkEditorProps {
  groups: ModifierGroup[];
  /** Products come from the catalog query the products tab already runs. */
  products: Array<{ id: string; name: string }>;
  productId: string;
  onProductChange: (productId: string) => void;
  links: ProductModifierLink[];
  isLoadingLinks: boolean;
  onToggle: (groupId: string) => void;
  pendingGroupId: string | null;
  error?: string;
}

/**
 * Attaches modifier groups to a product.
 *
 * The product is chosen first and the group rows reflect only that product, so
 * a stray click cannot link a group to the wrong drink. Toggling a row links or
 * unlinks depending on the product's current set.
 */
export function ModifierLinkEditor({
  groups,
  products,
  productId,
  onProductChange,
  links,
  isLoadingLinks,
  onToggle,
  pendingGroupId,
  error,
}: ModifierLinkEditorProps) {
  const { t } = useTranslation();

  return (
    <Card className="mb-4 space-y-3 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex-1 min-w-[220px]">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted">
            {t('adminMenu.productLinks')}
          </span>
          <select
            className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
            value={productId}
            onChange={(e) => onProductChange(e.target.value)}
          >
            <option value="">{t('adminMenu.productLinksPick')}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {productId && (
          <p className="text-xs text-muted">
            {isLoadingLinks
              ? t('common.loading')
              : t('adminMenu.productLinksCount', { count: links.length })}
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {!productId && <p className="text-sm text-muted">{t('adminMenu.productLinksHint')}</p>}

      {productId && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {groups.map((group) => {
            const linked = links.some((l) => l.group_id === group.id);
            return (
              <li key={group.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="truncate">
                  {group.name}
                  {group.required === 1 && (
                    <span className="ml-2 text-xs text-muted">{t('adminMenu.modifierRequired')}</span>
                  )}
                </span>
                <Button
                  variant={linked ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={() => onToggle(group.id)}
                  loading={pendingGroupId === group.id}
                  disabled={pendingGroupId === group.id}
                >
                  {linked ? t('adminMenu.unlink') : t('adminMenu.link')}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
