'use client';

import { useTranslation } from 'react-i18next';

interface StitchMenuNewHeaderProps {
  brandName: string;
}

export function StitchMenuNewHeader({ brandName }: StitchMenuNewHeaderProps) {
  const { t } = useTranslation();

  return (
    <header
      className="fixed top-0 z-50 w-full border-b border-[var(--aura-chrome-dim)]/30 bg-[var(--aura-surface-dim)]/60 backdrop-blur-md shadow-sm"
      aria-label={t('stitch.header')}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2">
        <div
          className="text-[32px] leading-[1.2] font-semibold tracking-tight text-[var(--aura-noir-void)]"
          style={{ fontFamily: '"EB Garamond", Georgia, serif' }}
        >
          {t('stitch.brandName', { defaultValue: brandName })}
        </div>

        <nav className="hidden items-center gap-4 md:flex" aria-label={t('stitch.nav')}>
          <a
            href="#"
            className="font-medium text-[var(--aura-chrome-soft)] transition-colors duration-300 hover:text-[var(--aura-chrome-bright)]"
          >
            {t('stitch.navHome', { defaultValue: 'Home' })}
          </a>
          <a
            href="#"
            className="border-b-2 border-[var(--aura-chrome-bright)] pb-1 font-medium text-[var(--aura-chrome-bright)] transition-colors duration-300"
          >
            {t('stitch.navMenu', { defaultValue: 'Menu' })}
          </a>
          <a
            href="#"
            className="font-medium text-[var(--aura-chrome-soft)] transition-colors duration-300 hover:text-[var(--aura-chrome-bright)]"
          >
            {t('stitch.navLocation', { defaultValue: 'Location' })}
          </a>
        </nav>

        <button
          className="rounded-full bg-[var(--aura-chrome-bright)] px-6 py-2 text-xs font-semibold tracking-[0.1em] text-[var(--aura-noir-deep)] transition-all active:scale-95 hover:opacity-90"
          style={{ fontFamily: '"Space Grotesk", system-ui, sans-serif' }}
        >
          {t('stitch.reservation', { defaultValue: 'Reservation' })}
        </button>
      </div>
    </header>
  );
}
