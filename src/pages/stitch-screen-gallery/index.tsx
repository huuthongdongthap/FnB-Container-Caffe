/* ── Stitch Screen Gallery ─────────────────────────────────────────── */
/* Lists all converted Stitch screens for visual QA / discovery */

import { useState, useCallback } from 'react';
import { StitchShell, StitchNav } from '../stitch/StitchBase';
import { SCREENS } from './screen-data';
import { GalleryHero } from './gallery-hero';
import { GalleryFilters } from './gallery-filters';
import { ScreenCard } from './screen-card';
import { EmptyState } from './empty-state';

export default function StitchGallery() {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [filter, setFilter] = useState('');

  const filtered = useCallback(
    (s: (typeof SCREENS)[number]) => {
      const catMatch =
        activeCategory === 'All' ||
        s.route?.includes(activeCategory.toLowerCase()) ||
        s.slug.toLowerCase().includes(activeCategory.toLowerCase());
      const textMatch =
        !filter ||
        s.name.toLowerCase().includes(filter.toLowerCase()) ||
        s.source.toLowerCase().includes(filter.toLowerCase());
      return catMatch && textMatch;
    },
    [activeCategory, filter]
  );

  const visible = SCREENS.filter(filtered);

  return (
    <StitchShell>
      <StitchNav ctaLabel="View Screens" />
      <GalleryHero />
      <section className="px-5 md:px-16 max-w-[1280px] mx-auto">
        <GalleryFilters
          activeCategory={activeCategory}
          filter={filter}
          onCategoryChange={setActiveCategory}
          onFilterChange={setFilter}
        />
      </section>
      <main className="px-5 md:px-16 max-w-[1280px] mx-auto pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {visible.map(screen => (
            <ScreenCard key={screen.slug} screen={screen} />
          ))}
        </div>
        {visible.length === 0 && (
          <EmptyState onClear={() => { setFilter(''); setActiveCategory('All'); }} />
        )}
      </main>
    </StitchShell>
  );
}
