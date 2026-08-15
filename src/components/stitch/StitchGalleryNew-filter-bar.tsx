/**
 * Filter bar component for StitchGalleryNew
 */

import type { FilterId } from './StitchGalleryNew-types';
import { filterOptions } from './StitchGalleryNew-constants';

interface GalleryFilterBarProps {
  activeFilter: FilterId;
  onFilterChange: (filter: FilterId) => void;
}

export function GalleryFilterBar({ activeFilter, onFilterChange }: GalleryFilterBarProps) {
  return (
    <nav className="scrollbar-hide mb-12 flex gap-8 overflow-x-auto border-b border-[var(--aura-chrome-soft)]/20 pb-4">
      {filterOptions.map((filter) => {
        const isActive = activeFilter === filter.id;
        return (
          <button
            key={filter.id}
            type="button"
            onClick={() => onFilterChange(filter.id)}
            className={`relative flex flex-col items-start transition-opacity focus:outline-none ${
              isActive ? 'opacity-100' : 'opacity-50 hover:opacity-100'
            }`}
          >
            <span
              className={`mb-2 font-[family-name:var(--aura-body-font)] text-base uppercase tracking-widest ${
                isActive ? 'text-[var(--aura-bronze-shimmer)]' : 'text-[var(--aura-chrome-bright)]'
              }`}
            >
              {filter.label}
            </span>
            <div
              className="filter-underline"
              style={{
                height: '2px',
                width: '100%',
                background: isActive ? 'var(--aura-bronze-shimmer)' : 'transparent',
                transition: 'background 0.2s',
              }}
            />
          </button>
        );
      })}
    </nav>
  );
}
