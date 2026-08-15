import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { HeaderProps } from './StitchMenu2New-types';

export function Header({ brandName }: HeaderProps) {
  const { t } = useTranslation();
  return (
    <header
      className="fixed top-0 z-50 w-full border-b border-[#c7c6c4]/30 bg-[var(--aura-bg-page, #0A1A2E)]/80 backdrop-blur-xl"
      aria-label={t('stitch.menu2.navAriaLabel')}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 md:px-16">
        {/* Brand */}
        <div className="font-display text-2xl uppercase tracking-tighter text-[var(--aura-text-primary, #e8e8e8)] md:text-[32px]">
          {brandName}
        </div>

        {/* Desktop Nav */}
        <nav
          className="hidden items-center gap-8 md:flex"
          aria-label={t('stitch.menu2.navLabel')}
        >
          <a
            href="#"
            className="font-body text-base uppercase tracking-wider text-[#c4c6ce] transition-colors hover:text-[#b5c8e7]"
            aria-label={t('stitch.menu2.navHome')}
          >
            {t('stitch.menu2.navHome')}
          </a>
          <a
            href="#"
            className="border-b-2 border-[#ffb779] pb-1 font-body text-base uppercase tracking-wider text-[#b5c8e7]"
            aria-label={t('stitch.menu2.navMenu')}
          >
            {t('stitch.menu2.navMenu')}
          </a>
          <a
            href="#"
            className="font-body text-base uppercase tracking-wider text-[#c4c6ce] transition-colors hover:text-[#b5c8e7]"
            aria-label={t('stitch.menu2.navLocation')}
          >
            {t('stitch.menu2.navLocation')}
          </a>
        </nav>

        {/* Search + Reservation */}
        <div className="flex items-center gap-6">
          {/* Desktop Search */}
          <div
            className="hidden items-center gap-2 border-b border-[#E5E4E2]/30 py-1 lg:flex"
            role="search"
            aria-label={t('stitch.menu2.searchAriaLabel')}
          >
            <Search className="h-4 w-4 text-[#8e9097]" aria-hidden="true" />
            <input
              type="text"
              placeholder={t('stitch.menu2.searchPlaceholder')}
              aria-label={t('stitch.menu2.searchAriaLabel')}
              className="w-48 border-none bg-transparent font-body text-sm font-medium text-[#c4c6ce] placeholder-[#8e9097]/50 focus:outline-none focus:ring-0"
            />
          </div>

          {/* Reservation CTA */}
          <button
            className="bg-[#E5E4E2] px-6 py-2 font-body text-[12px] font-semibold uppercase tracking-widest text-[#1e314a] transition-all active:scale-95 hover:bg-white"
            aria-label={t('stitch.menu2.reservationAriaLabel')}
          >
            {t('stitch.menu2.reservation')}
          </button>
        </div>
      </div>
    </header>
  );
}
