'use client';

import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';

interface StitchMenuNewSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function StitchMenuNewSearchBar({
  searchQuery,
  onSearchChange,
}: StitchMenuNewSearchBarProps) {
  const { t } = useTranslation();

  return (
    <div className="relative w-full md:w-80 group" role="search">
      <Search
        className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--aura-chrome-dim)] transition-colors group-focus-within:text-[#c6c6c7]"
        aria-hidden="true"
      />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={t('stitch.searchPlaceholder', { defaultValue: 'Search our craft...' })}
        aria-label={t('stitch.searchAriaLabel')}
        className="w-full rounded-full border border-[var(--aura-chrome-dim)]/50 bg-[#061c35] py-3 pl-12 pr-12 text-base text-[#c6c6c7] placeholder-[var(--aura-chrome-dim)] transition-all focus:border-[#c6c6c7] focus:outline-none"
        style={{ fontFamily: '"Space Grotesk", system-ui, sans-serif' }}
      />
      {searchQuery !== '' && (
        <button
          onClick={() => onSearchChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--aura-chrome-dim)] transition-colors hover:text-[#c6c6c7]"
          aria-label={t('stitch.clearSearchAriaLabel')}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
