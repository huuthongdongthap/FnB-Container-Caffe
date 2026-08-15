'use client';

import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react';

interface StitchMenuNewFavoritesFilterProps {
  showFavoritesOnly: boolean;
  onToggle: () => void;
}

export function StitchMenuNewFavoritesFilter({
  showFavoritesOnly,
  onToggle,
}: StitchMenuNewFavoritesFilterProps) {
  const { t } = useTranslation();

  return (
    <div className="mb-6 flex items-center">
      <button
        onClick={onToggle}
        className={`flex items-center gap-2 rounded-full border px-5 py-2 text-xs font-semibold tracking-[0.1em] transition-all aura-glass ${
          showFavoritesOnly
            ? 'border-[var(--aura-chrome-bright)] text-[var(--aura-chrome-bright)] bronze-glow'
            : 'border-[var(--aura-chrome-dim)]/30 text-[var(--aura-chrome-soft)] hover:border-[#c6c6c7] hover:text-[#c6c6c7]'
        }`}
        aria-pressed={showFavoritesOnly}
        aria-label={t(showFavoritesOnly ? 'stitch.favoritesFilterActiveAria' : 'stitch.favoritesFilterAria')}
        style={{ fontFamily: '"Space Grotesk", system-ui, sans-serif' }}
      >
        <Heart
          className="h-3.5 w-3.5"
          aria-hidden="true"
          fill={showFavoritesOnly ? 'currentColor' : 'none'}
        />
        {t('stitch.favorites')}
      </button>
    </div>
  );
}
