'use client';

import { useTranslation } from 'react-i18next';
import { DEFAULT_ITEMS } from './StitchMenuNew-data';
import { useStitchMenuNew } from './use-stitch-menu-new';
import { StitchMenuNewHeader } from './StitchMenuNew-header';
import { StitchMenuNewSearchBar } from './StitchMenuNew-search-bar';
import { StitchMenuNewCategoryFilter } from './StitchMenuNew-category-filter';
import { StitchMenuNewFavoritesFilter } from './StitchMenuNew-favorites-filter';
import { StitchMenuNewMenuCard } from './StitchMenuNew-menu-card';
import { StitchMenuNewEmptyState } from './StitchMenuNew-empty-state';
import { StitchMenuNewFooter } from './StitchMenuNew-footer';
import { StitchMenuNewCartFab } from './StitchMenuNew-cart-fab';
import { GLASS_PANEL_STYLE_ID, GLASS_PANEL_CSS } from './StitchMenuNew-styles';

export type { MenuItemData, StitchMenuNewProps } from './StitchMenuNew-types';
import type { StitchMenuNewProps, MenuItemData } from './StitchMenuNew-types';

export function StitchMenuNew({
  items = DEFAULT_ITEMS,
  brandName = 'AURA CAFE',
  onAddToCart,
  onCartClick,
  cartItemCount = 0,
}: Readonly<StitchMenuNewProps>) {
  const { t } = useTranslation();
  const state = useStitchMenuNew(items);

  const showGrid =
    !state.hasNoResults &&
    !state.hasNoItemsInCategory &&
    !(state.showFavoritesOnly && state.favIds.length === 0);

  return (
    <div
      className="relative min-h-screen bg-[var(--aura-surface-dim)] text-[var(--aura-chrome-bright)] overflow-x-hidden"
      aria-label={t('stitch.menu')}
    >
      <style id={GLASS_PANEL_STYLE_ID}>{GLASS_PANEL_CSS}</style>

      <StitchMenuNewHeader brandName={brandName} />

      <main className="min-h-screen pt-24 pb-8">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1
                className="text-[48px] leading-[1.1] font-semibold tracking-[-0.02em] text-[var(--aura-chrome-bright)] mb-2"
                style={{ fontFamily: '"EB Garamond", Georgia, serif' }}
              >
                {t('stitch.theDigitalReserve', { defaultValue: 'The Digital Reserve' })}
              </h1>
              <p
                className="max-w-lg text-base leading-[1.6] text-[var(--aura-chrome-soft)]"
                style={{ fontFamily: '"Space Grotesk", system-ui, sans-serif' }}
              >
                {t('stitch.menuDescription', {
                  defaultValue:
                    'Industrial precision meets high-end hospitality. Explore our curated selection of signature roasts and artisanal blends.',
                })}
              </p>
            </div>
            <StitchMenuNewSearchBar
              searchQuery={state.searchQuery}
              onSearchChange={state.setSearchQuery}
            />
          </div>

          <StitchMenuNewCategoryFilter
            activeCategory={state.activeCategory}
            onCategoryChange={state.setActiveCategory}
          />

          <StitchMenuNewFavoritesFilter
            showFavoritesOnly={state.showFavoritesOnly}
            onToggle={() => state.setShowFavoritesOnly((v) => !v)}
          />

          <StitchMenuNewEmptyState
            hasNoResults={state.hasNoResults}
            hasNoItemsInCategory={state.hasNoItemsInCategory}
            showFavoritesOnly={state.showFavoritesOnly}
            favIdsEmpty={state.favIds.length === 0}
          />

          {showGrid && (
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {state.filteredItems.map((item, index) => (
                <StitchMenuNewMenuCard
                  key={item.id}
                  item={item}
                  index={index}
                  totalDefaultItems={DEFAULT_ITEMS.length}
                  isDefaultDataset={items === DEFAULT_ITEMS}
                  isAdded={state.addedItems.has(item.id)}
                  isFavorite={state.isFavorite}
                  onToggleFavorite={state.toggleFavorite}
                  onAddToCart={(i) => state.handleAddToCart(i, onAddToCart)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <StitchMenuNewFooter brandName={brandName} />
      <StitchMenuNewCartFab cartItemCount={cartItemCount} onCartClick={onCartClick} />
    </div>
  );
}

export default StitchMenuNew;
