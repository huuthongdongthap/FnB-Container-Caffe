'use client';

import { useTranslation } from 'react-i18next';
import { CATEGORIES } from './StitchMenuNew-types';

interface StitchMenuNewCategoryFilterProps {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export function StitchMenuNewCategoryFilter({
  activeCategory,
  onCategoryChange,
}: StitchMenuNewCategoryFilterProps) {
  const { t } = useTranslation();

  return (
    <div
      className="mb-8 flex gap-3 overflow-x-auto pb-4 no-scrollbar"
      role="tablist"
      aria-label={t('stitch.filterAriaLabel')}
    >
      {CATEGORIES.map((cat) => {
        const isActive = activeCategory === cat.key;
        return (
          <button
            key={cat.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onCategoryChange(cat.key)}
            className={`flex-shrink-0 rounded-full border px-6 py-2 text-xs font-semibold tracking-[0.1em] transition-all aura-glass ${
              isActive
                ? 'border-[var(--aura-chrome-bright)] text-[var(--aura-chrome-bright)] bronze-glow'
                : 'border-[var(--aura-chrome-dim)]/30 text-[var(--aura-chrome-soft)] hover:border-[#c6c6c7] hover:text-[#c6c6c7]'
            }`}
            style={{ fontFamily: '"Space Grotesk", system-ui, sans-serif' }}
          >
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
