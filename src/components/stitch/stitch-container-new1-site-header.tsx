'use client';

import { useTranslation } from 'react-i18next';

/**
 * Fixed site header for AURA CAFE container page.
 */
export function SiteHeader({ onReservation }: { onReservation?: () => void }) {
  const { t } = useTranslation();
  return (
    <header
      className="fixed top-0 z-50 w-full border-b shadow-sm backdrop-blur-md"
      style={{
        backgroundColor: 'rgba(12, 32, 56, 0.6)',
        borderColor: 'color-mix(in srgb, var(--aura-chrome-dim) 15%, transparent)',
        WebkitBackdropFilter: 'blur(12px)',
        backdropFilter: 'blur(12px)',
      }}
      aria-label={t('common.mainNavigation', { defaultValue: 'Main Navigation' })}
    >
      <nav className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-8 py-6">
        {/* Brand */}
        <div
          className="text-[24px] leading-[1.4] tracking-widest uppercase"
          style={{
            fontFamily: "'EB Garamond', Georgia, serif",
            color: 'var(--aura-chrome-bright)',
          }}
        >
          AURA CAFE
        </div>

        {/* Desktop nav */}
        <div className="hidden items-center gap-12 md:flex">
          <a
            href="/"
            className="border-b-2 pb-1 font-bold"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '14px',
              lineHeight: '1.0',
              letterSpacing: '0.1em',
              color: 'var(--aura-noir-void)',
              borderColor: 'var(--aura-noir-void)',
            }}
            aria-current="page"
          >
            {t('containerNew1.home', { defaultValue: 'Home' })}
          </a>
          <a
            href="/menu"
            className="transition-colors"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '14px',
              lineHeight: '1.0',
              letterSpacing: '0.1em',
              color: 'var(--aura-chrome-soft)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--aura-chrome-bright)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--aura-chrome-soft)'; }}
          >
            {t('containerNew1.menu', { defaultValue: 'Menu' })}
          </a>
          <a
            href="/about"
            className="transition-colors"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '14px',
              lineHeight: '1.0',
              letterSpacing: '0.1em',
              color: 'var(--aura-chrome-soft)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--aura-chrome-bright)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--aura-chrome-soft)'; }}
          >
            {t('containerNew1.location', { defaultValue: 'Location' })}
          </a>
        </div>

        {/* Reservation button */}
        <button
          type="button"
          onClick={onReservation}
          className="rounded-full px-6 transition-transform hover:scale-105 active:scale-95"
          style={{
            paddingTop: '4px',
            paddingBottom: '4px',
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '14px',
            lineHeight: '1.0',
            letterSpacing: '0.1em',
            backgroundColor: 'var(--aura-chrome-bright)',
            color: 'var(--aura-noir-deep)',
          }}
          aria-label={t('containerNew1.reservation', { defaultValue: 'Reservation' })}
        >
          {t('containerNew1.reservation', { defaultValue: 'Reservation' })}
        </button>
      </nav>
    </header>
  );
}
