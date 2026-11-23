'use client';

import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Search, Coffee } from 'lucide-react';
import { MenuItemCard } from './StitchPOSNew-menu-item-card';
import { AddOnChip } from './StitchPOSNew-add-on-chip';
import type { POSNewMenuItem, POSNewAddOn } from './StitchPOSNew-types';
import { MENU_CATEGORIES, resolvePosCategoryLabel } from './StitchPOSNew-types';

interface MenuSectionProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeCategory: string;
  onCategoryChange: (c: string) => void;
  categories?: string[];
  categoryLabels?: Record<string, string>;
  filteredItems: POSNewMenuItem[];
  addOns: POSNewAddOn[];
  getQuantity: (id: string) => number;
  addToCart: (item: { id: string; name: string; price: number; category?: string }) => void;
  removeFromCart: (id: string) => void;
  cartOpen: boolean;
}

export function MenuSection({
  searchQuery,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  categories = MENU_CATEGORIES,
  categoryLabels,
  filteredItems,
  addOns,
  getQuantity,
  addToCart,
  removeFromCart,
  cartOpen,
}: MenuSectionProps) {
  const { t } = useTranslation();
  return (
    <section
      className={cn(
        'flex-1 flex flex-col h-full overflow-hidden px-5 py-4',
        cartOpen ? 'lg:mr-96' : ''
      )}
      aria-label={t('posNew.menuSection')}
    >
      {/* Search & Filters */}
      <div className="flex flex-col gap-3 mb-4 shrink-0">
        <div className="relative w-full max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--aura-text-muted,#6b5d50)]" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('posNew.searchPlaceholder')}
            className="w-full bg-[color-mix(in srgb,var(--aura-noir-void,rgba(var(--aura-noir-void),1)) 50%,transparent)] border border-[color-mix(in srgb,var(--aura-chrome-light,rgba(var(--aura-chrome-light),1)) 15%,transparent)] rounded-lg py-3 pl-11 pr-4 text-[14px] text-[var(--aura-text-primary,var(--aura-chrome-bright,#eae1db))] focus:outline-none focus:border-[color-mix(in srgb,var(--aura-chrome-light,rgba(var(--aura-chrome-light),1)) 40%,transparent)] transition-all placeholder:text-[var(--aura-text-muted,#6b5d50)] font-body"
            aria-label={t('posNew.searchPlaceholder')}
          />
        </div>
        <div className="flex gap-2.5 overflow-x-auto pb-1.5 custom-scrollbar-pos" role="tablist" aria-label={t('posNew.categoryFilter')}>
          {categories.map((cat) => {
            const label = resolvePosCategoryLabel(cat, categoryLabels);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onCategoryChange(cat)}
                className={cn(
                  'shrink-0 px-4 py-2 rounded-lg border text-[12px] font-semibold tracking-wide whitespace-nowrap active:scale-95 transition-all font-body cursor-pointer',
                  activeCategory === cat
                    ? 'bg-[var(--aura-primary,var(--aura-chrome-light,#f2c08d))] text-[var(--aura-noir-void,#1a1008)] border-[var(--aura-primary,#f2c08d)]'
                    : 'bg-[rgba(var(--aura-noir-void),0.55)] text-[var(--aura-text-muted,#b8a898)] border-[rgba(var(--aura-chrome-light),0.16)] hover:text-[var(--aura-text-primary,#eae1db)] hover:border-[rgba(var(--aura-chrome-light),0.35)]'
                )}
                role="tab"
                aria-selected={activeCategory === cat}
                aria-label={`${label} ${t('posNew.category')}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Menu Grid Area */}
      <div className="flex-1 overflow-y-auto pr-2 pb-24 custom-scrollbar-pos">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Coffee className="w-12 h-12 text-[color-mix(in srgb,var(--aura-chrome-light,rgba(var(--aura-chrome-light),1)) 12%,transparent)] mb-4" />
            <p className="text-[14px] text-[var(--aura-text-muted,#8a7a6a)] font-body">
              {searchQuery ? t('posNew.noResults') : t('posNew.noItemsInCategory')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 mb-6">
            {filteredItems.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                quantity={getQuantity(item.id)}
                onAdd={() => addToCart(item)}
                onRemove={() => removeFromCart(item.id)}
              />
            ))}
          </div>
        )}

        {addOns.length > 0 && (
          <div className="mb-6">
            <h2 className="text-[13px] text-[var(--aura-text-muted,#8a7a6a)] uppercase tracking-widest mb-3 font-body">
              {t('posNew.popularAddOns')}
            </h2>
            <div className="flex gap-3 flex-wrap">
              {addOns.map((addon) => (
                <AddOnChip
                  key={addon.id}
                  addon={addon}
                  onAdd={() =>
                    addToCart({
                      id: addon.id,
                      name: addon.name,
                      price: addon.price,
                      category: 'Add-ons',
                    })
                  }
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
