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
      aria-label={t('menu.CategoryNavAria', 'Danh mục thực đơn')}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2">
        <div
          className="text-[32px] leading-[1.2] font-semibold tracking-tight text-[var(--aura-noir-void)]"
          style={{ fontFamily: 'var(--aura-font-display)' }}
        >
          {t('stitch.brandName', { defaultValue: brandName })}
        </div>

        <nav className="hidden items-center gap-4 md:flex" aria-label={t('stitch.nav', { defaultValue: 'Main navigation' })}>
          <a
            href="/"
            className="font-medium text-[var(--aura-chrome-soft)] transition-colors duration-300 hover:text-[var(--aura-chrome-bright)]"
          >
            {t('stitch.navHome', { defaultValue: 'Home' })}
          </a>
          <a
            href="/menu"
            className="border-b-2 border-[var(--aura-chrome-bright)] pb-1 font-medium text-[var(--aura-chrome-bright)] transition-colors duration-300"
          >
            {t('stitch.navMenu', { defaultValue: 'Menu' })}
          </a>
          <a
            href="/contact"
            className="font-medium text-[var(--aura-chrome-soft)] transition-colors duration-300 hover:text-[var(--aura-chrome-bright)]"
          >
            {t('stitch.navLocation', { defaultValue: 'Location' })}
          </a>
        </nav>

        <button
          type="button"
          aria-label={t('stitch.reservation', { defaultValue: 'Reservation' })}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-[var(--aura-chrome-bright)] px-6 py-2 text-xs font-semibold tracking-[0.1em] text-[var(--aura-noir-deep)] transition-all active:scale-95 hover:opacity-90"
          style={{ fontFamily: 'var(--aura-font-body)' }}
        >
          {t('stitch.reservation', { defaultValue: 'Reservation' })}
        </button>
      </div>
    </header>
  );
}
