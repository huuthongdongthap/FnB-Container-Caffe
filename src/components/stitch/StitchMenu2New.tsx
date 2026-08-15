'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MenuItem2Data, StitchMenu2NewProps } from './StitchMenu2New-types';
import { DEFAULT_ITEMS } from './StitchMenu2New-data';
import { Header } from './StitchMenu2New-header';
import { Hero } from './StitchMenu2New-hero';
import { MenuGrid } from './StitchMenu2New-menu-grid';
import { CraftSection } from './StitchMenu2New-craft-section';
import { Footer } from './StitchMenu2New-footer';
import { CartFab } from './StitchMenu2New-cart-fab';

// Re-export types for external consumers
export type { MenuItem2Data, StitchMenu2NewProps } from './StitchMenu2New-types';

export function StitchMenu2New({
  items = DEFAULT_ITEMS,
  brandName = 'AURA CAFE',
  onAddToOrder,
  onCartClick,
  cartItemCount = 0,
}: Readonly<StitchMenu2NewProps>) {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState('all');
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());

  const filteredItems = items.filter((item) => {
    return activeCategory === 'all' || item.category === activeCategory;
  });

  const hasNoItemsInCategory = activeCategory !== 'all' && filteredItems.length === 0;

  const handleAddToOrder = (item: MenuItem2Data) => {
    onAddToOrder?.(item);
    setAddedItems((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });
    setTimeout(() => {
      setAddedItems((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }, 2000);
  };

  return (
    <div
      className="relative min-h-screen bg-[var(--aura-bg-page, #0A1A2E)] text-[var(--aura-text-primary, #e8e8e8)] overflow-x-hidden"
      aria-label={t('stitch.menu2.pageLabel')}
    >
      <Header brandName={brandName} />

      <main className="mx-auto min-h-screen max-w-7xl px-4 pt-32 pb-24 md:px-16">
        <Hero activeCategory={activeCategory} onCategoryChange={setActiveCategory} />

        {hasNoItemsInCategory && (
          <div className="py-20 text-center" role="status">
            <p className="font-body text-lg text-[#c4c6ce]">
              {t('stitch.menu2.noItemsInCategory')}
            </p>
          </div>
        )}

        {!hasNoItemsInCategory && (
          <MenuGrid items={filteredItems} addedItems={addedItems} onAddToOrder={handleAddToOrder} />
        )}

        <CraftSection />
      </main>

      <Footer brandName={brandName} />

      {onCartClick && (
        <CartFab cartItemCount={cartItemCount} onCartClick={onCartClick} />
      )}
    </div>
  );
}

export default StitchMenu2New;
