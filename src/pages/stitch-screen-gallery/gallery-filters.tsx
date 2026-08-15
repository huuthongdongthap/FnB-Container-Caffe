/* ── Stitch Screen Gallery — Filters ───────────────────────────── */

import { CATEGORIES } from './screen-data';

interface GalleryFiltersProps {
  activeCategory: string;
  filter: string;
  onCategoryChange: (cat: string) => void;
  onFilterChange: (val: string) => void;
}

export function GalleryFilters({
  activeCategory,
  filter,
  onCategoryChange,
  onFilterChange,
}: GalleryFiltersProps) {
  return (
    <div className="mt-8 flex flex-col md:flex-row gap-4 items-start md:items-center">
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            className={`px-4 py-1.5 rounded-full font-body text-xs font-semibold uppercase tracking-widest transition-all active:scale-95 ${
              activeCategory === cat
                ? 'bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)]'
                : 'glass-panel text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="md:ml-auto">
        <input
          type="text"
          placeholder="Search screens..."
          value={filter}
          onChange={e => onFilterChange(e.target.value)}
          className="glass-panel px-4 py-2 rounded-lg font-body text-sm text-[var(--aura-chrome-bright)] placeholder:text-[var(--aura-chrome-mid)] w-full md:w-56 outline-none"
        />
      </div>
    </div>
  );
}
