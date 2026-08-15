/**
 * StitchGalleryNew — AURA CAFE Design Gallery (Stitch design, regenerated to exact HTML match)
 *
 * Dark navy design gallery with filter bar (All/Industrial/Luxury/Tech),
 * 4 gallery cards (grid 2 cols), load more button, and bottom nav.
 * Supports scroll-reveal animation and active item selection.
 * Mobile-first responsive. Named export.
 * Source: stitch-exports/new-screens/design-gallery.html
 */
'use client';

import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useScrollReveal } from './StitchGalleryNew-hooks';
import { GalleryTopBar, GallerySectionHeader } from './StitchGalleryNew-gallery-header';
import { GalleryFilterBar } from './StitchGalleryNew-filter-bar';
import { GalleryCard } from './StitchGalleryNew-gallery-card';
import { GalleryLoadMore } from './StitchGalleryNew-load-more';
import { GalleryBottomNav } from './StitchGalleryNew-bottom-nav';
import { defaultItems } from './StitchGalleryNew-constants';
import type { FilterId, StitchGalleryNewProps, GalleryItem } from './StitchGalleryNew-types';

export type { FilterId, GalleryItem, StitchGalleryNewProps };

export function StitchGalleryNew({
  items = defaultItems,
  onItemClick,
  onLoadMore,
}: Readonly<StitchGalleryNewProps>) {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useScrollReveal(gridRef, activeFilter);

  const filteredItems = useCallback(() => {
    if (activeFilter === 'all') return items;
    return items.filter((item) => item.filter === activeFilter);
  }, [activeFilter, items]);

  const handleItemClick = (itemId: string) => {
    setActiveItem(itemId === activeItem ? null : itemId);
    onItemClick?.(itemId);
    if (window.navigator.vibrate) {
      window.navigator.vibrate(5);
    }
  };

  const currentItems = filteredItems();

  return (
    <>
      <GalleryTopBar />

      <main className="mx-auto max-w-5xl px-6 pb-32 pt-32">
        <GallerySectionHeader />
        <GalleryFilterBar activeFilter={activeFilter} onFilterChange={setActiveFilter} />

        <div ref={gridRef} className="grid grid-cols-1 gap-10 md:grid-cols-2">
          {currentItems.map((item) => (
            <GalleryCard
              key={item.id}
              item={item}
              isSelected={activeItem === item.id}
              onClick={handleItemClick}
            />
          ))}
        </div>

        {currentItems.length > 0 && <GalleryLoadMore onClick={onLoadMore} />}
      </main>

      <GalleryBottomNav />
    </>
  );
}
