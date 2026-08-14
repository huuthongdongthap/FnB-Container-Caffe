/**
 * Navigation bar and hero section for StitchEventsNew2.
 * Extracted from StitchEventsNew2.tsx to keep individual files under 200 LOC.
 */

'use client';

import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import type { NavLinkItem, EventsNew2PageData } from './StitchEventsNew2-types';
import { CalendarIcon } from './stitch-events-icons';

/* ─── Nav Bar ───────────────────────────────────────────────────── */

export function NavBar({
  links,
  onNavClick,
}: {
  links: NavLinkItem[];
  onNavClick?: (key: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <nav
      className="fixed top-0 z-50 flex h-20 w-full items-center border-b shadow-sm backdrop-blur-xl"
      style={{
        backgroundColor: 'rgba(8,20,37,0.8)',
        borderColor: 'rgba(68,71,77,0.2)',
      }}
      aria-label={t('common.mainNavigation')}
    >
      <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-5 md:px-12">
        {/* Brand */}
        <span
          className="text-2xl italic tracking-tighter md:text-[32px]"
          style={{
            fontFamily: 'var(--aura-font-display-serif, "Libre Caslon Text", Georgia, serif)',
            color: 'var(--aura-text-primary, #e8e8e8)',
          }}
        >
          AURA CAFE
        </span>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <button
              key={link.key}
              type="button"
              onClick={() => onNavClick?.(link.key)}
              className={clsx(
                'font-label-caps text-sm transition-colors',
                link.active
                  ? 'border-b pb-1'
                  : 'hover:text-[var(--aura-text-primary, #e8e8e8)]',
              )}
              style={{
                color: link.active ? '#efbd8a' : 'var(--aura-text-secondary, #a0a8b0)',
                borderColor: link.active ? '#efbd8a' : 'transparent',
              }}
              aria-current={link.active ? 'page' : undefined}
              aria-label={link.label}
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* CTA */}
        <button
          type="button"
          className="rounded-lg px-6 py-2.5 font-label-caps text-xs uppercase tracking-wider shadow-md transition-all duration-200 active:scale-95"
          style={{
            backgroundColor: '#efbd8a',
            color: '#472a03',
            boxShadow: '0 0 12px rgba(239,189,138,0.2)',
          }}
          aria-label={t('events.bookTable')}
        >
          {t('events.bookTable')}
        </button>
      </div>
    </nav>
  );
}

/* ─── Hero Section ──────────────────────────────────────────────── */

export function HeroSection({
  data,
  onReserveSpot,
  onViewDetails,
}: {
  data: EventsNew2PageData;
  onReserveSpot?: () => void;
  onViewDetails?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section
      className="relative flex min-h-[870px] items-center justify-center overflow-hidden"
      aria-label={t('events.featured')}
    >
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div
          className="h-full w-full scale-110 bg-cover bg-center transition-transform duration-[10s] hover:scale-100"
          style={{ backgroundImage: `url(${data.heroImageUrl})` }}
          role="img"
          aria-label={data.heroImageAlt}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--aura-bg-page, #0A1A2E)] via-[rgba(8,20,37,0.4)] to-transparent" />
      </div>

      {/* Content — glassmorphism panel */}
      <div className="relative z-10 w-full max-w-[1280px] px-5 md:px-12">
        <div
          className="w-full max-w-xl rounded-xl border-l-2 p-8 md:w-7/12 md:p-12"
          style={{
            backgroundColor: 'rgba(21,32,49,0.4)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '0.5px solid rgba(197,198,205,0.15)',
            borderLeft: '2px solid rgba(239,189,138,0.5)',
          }}
        >
          <span className="mb-4 block font-label-caps text-xs tracking-[0.3em] text-[#efbd8a] uppercase">
            {data.heroTag}
          </span>
          <h1
            className="mb-6 text-[56px] leading-tight italic text-white md:text-[64px] md:leading-[1.1]"
            style={{
              fontFamily: "var(--aura-font-display)",
              letterSpacing: '-0.02em',
            }}
          >
            {data.heroTitle}
          </h1>
          <p
            className="mb-8 max-w-xl text-lg leading-relaxed"
            style={{
              color: 'var(--aura-text-secondary, #a0a8b0)',
              fontFamily: "var(--aura-font-body)",
            }}
          >
            {data.heroDescription}
          </p>
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={onReserveSpot}
              className="inline-flex items-center gap-2 rounded-lg px-10 py-4 font-label-caps text-xs uppercase tracking-wider transition-all hover:brightness-110"
              style={{
                backgroundColor: '#efbd8a',
                color: '#472a03',
                boxShadow: '0 0 12px rgba(239,189,138,0.2)',
              }}
              aria-label={t('events.reserveSpot')}
            >
              {t('events.reserveSpot')}
              <CalendarIcon className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              onClick={onViewDetails}
              className="rounded-lg px-10 py-4 font-label-caps text-xs uppercase tracking-wider transition-all"
              style={{
                background: 'transparent',
                border: '0.5px solid var(--aura-primary, #c6c6c7)',
                color: 'var(--aura-primary, #c6c6c7)',
              }}
              aria-label={t('events.viewDetails')}
            >
              {t('events.viewDetails')}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
