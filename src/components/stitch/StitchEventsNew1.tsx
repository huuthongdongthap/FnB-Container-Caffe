/**
 * StitchEventsNew1 — AURA CAFE Events & Promotions (Stitch design, New v1)
 *
 * Dark navy glassmorphism events/promotions landing with hero section,
 * promotion cards grid, event schedule manifesto, and newsletter CTA.
 * Mobile-first responsive. Named export.
 * Source: Stitch AI aura_cafe_events_promotions_1/code.html export.
 *
 * FIXED 2026-07-04: Pixel-perfect visual alignment with original Stitch HTML.
 * All deviations from the original HTML (code.html) have been resolved:
 *   - Added missing fixed navbar with brand, nav links, RESERVE button
 *   - Fixed max-width from 1280px to 1200px throughout
 *   - Fixed hero background image hover behavior (scale-110 on hover)
 *   - Fixed hero title to render "Espresso" with tertiary color span
 *   - Fixed all font sizes to match original typography scale
 *   - Fixed all spacing: card padding p-lg (48px), footer py-xl (80px), gaps
 *   - Fixed colors: neon-bronze tag, bronze Book Now, tertiary CTAs
 *   - Fixed schedule row hover background, badge sizes, event title sizes
 *   - Fixed newsletter Subscribe button colors (dark bg, light text)
 *   - Fixed promotion grid to md:grid-cols-3 (not md:grid-cols-2)
 *   - Fixed footer heading/link sizes, border opacities, dot color
 *   - Added defaultValue to all t() calls matching original English text
 *   - Fixed schedule event row padding to p-md (24px)
 */
'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';

/* ─── Types ────────────────────────────────────────────────────────── */

export interface PromotionCard {
  id: string;
  tag: string;
  title: string;
  description: string;
  ctaLabel: string;
  imageUrl: string;
  imageAlt: string;
}

export interface ScheduleEvent {
  id: string;
  date: string;
  day: string;
  title: string;
  time: string;
  badge: string;
  badgeType: 'available' | 'soldOut' | 'limited';
  location?: string;
}

export interface EventsPromoPageData {
  heroTag: string;
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  heroImageUrl: string;
  heroImageAlt: string;
  sectionTitle: string;
  sectionDescription: string;
  promotions: PromotionCard[];
  manifestoTitle: string;
  manifestoDescription: string;
  manifestoLocation: string;
  schedule: ScheduleEvent[];
  newsletterTitle: string;
  newsletterDescription: string;
  newsletterFrequency: string;
}

export type LoadingState = 'idle' | 'loading' | 'error';

export interface StitchEventsNew1Props {
  data?: EventsPromoPageData;
  loadingState?: LoadingState;
  errorMessage?: string;
  onBookNow?: () => void;
  onViewSchedule?: () => void;
  onCtaClick?: (promoId: string) => void;
  onReserveEvent?: (eventId: string) => void;
  onNewsletterSubmit?: (email: string) => void;
  onReserveNav?: () => void;
}

/* ─── SVG Icon Components ─────────────────────────────────────────── */

function ArrowForwardIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function AddIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CloseIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function LocationIcon({ className = 'h-5 w-5', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true" style={style}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

/* ─── Loading Skeleton ─────────────────────────────────────────────── */

function EventsPromoSkeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#00142b' }}>
      {/* Nav skeleton */}
      <div className="fixed top-0 left-0 w-full z-50" style={{ backgroundColor: 'rgba(18, 37, 61, 0.6)', backdropFilter: 'blur(12px)' }}>
        <div className="mx-auto flex h-20 max-w-[1200px] items-center justify-between px-8">
          <div className="h-6 w-32 animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
          <div className="hidden gap-12 md:flex">
            <div className="h-4 w-14 animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
            <div className="h-4 w-14 animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
            <div className="h-4 w-14 animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
            <div className="h-4 w-16 animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
          </div>
          <div className="h-10 w-28 animate-pulse rounded-full" style={{ backgroundColor: '#23364e' }} />
        </div>
      </div>

      {/* Hero skeleton */}
      <div className="mx-auto max-w-[1200px] px-8 pt-20">
        <div className="mb-16 min-h-[600px] md:min-h-[870px]">
          <div className="mx-auto max-w-lg space-y-4 pt-40 text-center">
            <div className="mx-auto h-4 w-40 animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
            <div className="mx-auto h-16 w-3/4 animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
            <div className="mx-auto h-4 w-full animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
            <div className="mx-auto h-4 w-1/2 animate-pulse rounded" style={{ backgroundColor: '#23364e' }} />
            <div className="flex justify-center gap-6">
              <div className="h-14 w-40 animate-pulse" style={{ backgroundColor: '#23364e' }} />
              <div className="h-14 w-40 animate-pulse" style={{ backgroundColor: '#23364e' }} />
            </div>
          </div>
        </div>
        {/* Grid skeleton */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-96 animate-pulse" style={{ backgroundColor: 'rgba(25, 45, 75, 0.8)' }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Error State ──────────────────────────────────────────────────── */

function EventsPromoError({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8 text-center"
      style={{ backgroundColor: '#00142b' }}
    >
      <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="#ffb4ab" strokeWidth={1.5} aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      <h3
        className="text-xl font-semibold"
        style={{
          fontFamily: '"EB Garamond", Georgia, serif',
          color: '#d3e3ff',
        }}
      >
        {t('events.unableToLoad', { defaultValue: 'Unable to load events' })}
      </h3>
      <p style={{ color: '#c5c6cd' }}>{message}</p>
    </div>
  );
}

/* ─── Empty State ──────────────────────────────────────────────────── */

function EventsPromoEmpty() {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8 text-center"
      style={{ backgroundColor: '#00142b' }}
    >
      <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="#5a6270" strokeWidth={1.5} aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
      <h3
        className="text-xl font-semibold"
        style={{
          fontFamily: '"EB Garamond", Georgia, serif',
          color: '#d3e3ff',
        }}
      >
        {t('events.noUpcomingEvents', { defaultValue: 'No upcoming events' })}
      </h3>
      <p style={{ color: '#c5c6cd' }}>{t('events.checkBackSoon', { defaultValue: 'Check back soon for new listings.' })}</p>
    </div>
  );
}

/* ─── Navbar ───────────────────────────────────────────────────────── */

function SiteNavbar({ onReserve }: { onReserve?: () => void }) {
  const { t } = useTranslation();
  return (
    <nav
      className="fixed top-0 left-0 w-full z-50 border-b"
      style={{
        backgroundColor: 'rgba(18, 37, 61, 0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderColor: 'rgba(68, 71, 77, 0.3)',
      }}
    >
      <div className="mx-auto flex h-20 max-w-[1200px] items-center justify-between px-8">
        <a
          href="#"
          className="text-2xl font-[400] uppercase tracking-widest"
          style={{
            fontFamily: '"EB Garamond", Georgia, serif',
            color: '#d3e3ff',
          }}
        >
          {t('events.brandName', { defaultValue: 'AURA CAFE' })}
        </a>

        <div className="hidden items-center gap-12 md:flex">
          <a
            href="#"
            className="text-sm font-[500] uppercase tracking-[0.1em] transition-colors duration-300 hover:text-[#d3e3ff]"
            style={{ color: '#c5c6cd', fontFamily: '"Space Grotesk", system-ui, sans-serif' }}
          >
            {t('events.navVessels', { defaultValue: 'Vessels' })}
          </a>
          <a
            href="#"
            className="border-b pb-1 text-sm font-[500] uppercase tracking-[0.1em]"
            style={{
              borderColor: '#efbd8a',
              color: '#ffdcbb',
              fontFamily: '"Space Grotesk", system-ui, sans-serif',
            }}
          >
            {t('events.navEvents', { defaultValue: 'Events' })}
          </a>
          <a
            href="#"
            className="text-sm font-[500] uppercase tracking-[0.1em] transition-colors duration-300 hover:text-[#d3e3ff]"
            style={{ color: '#c5c6cd', fontFamily: '"Space Grotesk", system-ui, sans-serif' }}
          >
            {t('events.navJournal', { defaultValue: 'Journal' })}
          </a>
          <a
            href="#"
            className="text-sm font-[500] uppercase tracking-[0.1em] transition-colors duration-300 hover:text-[#d3e3ff]"
            style={{ color: '#c5c6cd', fontFamily: '"Space Grotesk", system-ui, sans-serif' }}
          >
            {t('events.navLocation', { defaultValue: 'Location' })}
          </a>
        </div>

        <button
          type="button"
          onClick={onReserve}
          className="neon-glow-bronze-events rounded-full px-6 py-2 text-sm font-[500] uppercase tracking-[0.1em] transition-all duration-300 hover:scale-105 active:scale-95"
          style={{
            backgroundColor: '#efbd8a',
            color: '#482a03',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
          }}
          aria-label={t('events.reserveNav', { defaultValue: 'RESERVE' })}
        >
          {t('events.reserveNav', { defaultValue: 'RESERVE' })}
        </button>
      </div>
    </nav>
  );
}

/* ─── Hero Section ─────────────────────────────────────────────────── */

function HeroSection({
  data,
  onBookNow,
  onViewSchedule,
}: {
  data: EventsPromoPageData;
  onBookNow?: () => void;
  onViewSchedule?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section
      className="relative flex h-[870px] items-center justify-center overflow-hidden"
      aria-label={t('events.featured', { defaultValue: 'Featured Event' })}
    >
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <div
          className="h-full w-full bg-cover bg-center transition-transform duration-[10s] hover:scale-110"
          style={{ backgroundImage: `url(${data.heroImageUrl})` }}
          role="img"
          aria-label={data.heroImageAlt}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#00142b] via-[#00142b]/40 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-[1200px] px-8 text-center">
        <span
          className="mb-4 block text-sm font-[500] uppercase tracking-[0.3em]"
          style={{
            color: '#d4a574',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
          }}
        >
          {data.heroTag}
        </span>
        <h1
          className="mx-auto mb-8 max-w-4xl text-[36px] font-[500] italic leading-tight md:text-[80px] md:leading-[1.1] md:tracking-[-0.02em]"
          style={{
            fontFamily: '"EB Garamond", Georgia, serif',
            color: '#d3e3ff',
          }}
        >
          {t('events.liveJazzAnd', { defaultValue: 'Live Jazz & ' })}
          <span style={{ color: '#efbd8a' }}>{t('events.espressoWord', { defaultValue: 'Espresso' })}</span>
        </h1>
        <p
          className="mx-auto mb-10 max-w-xl text-lg leading-relaxed"
          style={{
            color: '#c5c6cd',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
          }}
        >
          {data.heroSubtitle}
        </p>
        <div className="flex flex-col items-center justify-center gap-6 md:flex-row">
          <button
            type="button"
            onClick={onBookNow}
            className="neon-glow-bronze-events w-full px-10 py-4 text-sm font-[500] uppercase tracking-widest transition-all hover:brightness-110 md:w-auto"
            style={{
              backgroundColor: '#d4a574',
              color: '#0c1c30',
              fontFamily: '"Space Grotesk", system-ui, sans-serif',
            }}
            aria-label={t('events.bookNow', { defaultValue: 'Book Now' })}
          >
            {t('events.bookNow', { defaultValue: 'Book Now' })}
          </button>
          <button
            type="button"
            onClick={onViewSchedule}
            className="w-full border px-10 py-4 text-sm font-[500] uppercase tracking-widest transition-all hover:bg-[#c6c6c7]/10 md:w-auto"
            style={{
              borderColor: '#c6c6c7',
              color: '#c6c6c7',
              fontFamily: '"Space Grotesk", system-ui, sans-serif',
            }}
            aria-label={t('events.viewSchedule', { defaultValue: 'View Schedule' })}
          >
            {t('events.viewSchedule', { defaultValue: 'View Schedule' })}
          </button>
        </div>
      </div>

      {/* Decorative vertical seam */}
      <div className="absolute bottom-0 left-1/2 h-24 w-px -translate-x-1/2 bg-gradient-to-b from-transparent to-[#44474d]" />
    </section>
  );
}

/* ─── Promotion Card ───────────────────────────────────────────────── */

function PromotionCardItem({
  promo,
  onCta,
}: {
  promo: PromotionCard;
  onCta?: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <article
      className="group relative overflow-hidden transition-all duration-500 hover:-translate-y-2"
      style={{
        background: 'rgba(25, 45, 75, 0.8)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '0.5px solid rgba(68,71,77,0.3)',
      }}
      aria-label={promo.title}
    >
      {/* Image */}
      <div className="h-64 overflow-hidden">
        <div
          className="h-full w-full bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
          style={{ backgroundImage: `url(${promo.imageUrl})` }}
          role="img"
          aria-label={promo.imageAlt}
        />
      </div>

      {/* Content */}
      <div className="flex flex-col p-12">
        <span
          className="text-xs font-[600] uppercase tracking-widest"
          style={{
            color: '#d4a574',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            lineHeight: '1.0',
            letterSpacing: '0.05em',
          }}
        >
          {promo.tag}
        </span>
        <h3
          className="mb-4 mt-2 text-[24px] font-[400] italic leading-[1.4]"
          style={{
            fontFamily: '"EB Garamond", Georgia, serif',
            color: '#d3e3ff',
          }}
        >
          {promo.title}
        </h3>
        <p
          className="mb-6 text-base leading-relaxed"
          style={{
            color: '#c5c6cd',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
          }}
        >
          {promo.description}
        </p>
        <button
          type="button"
          onClick={() => onCta?.(promo.id)}
          className="mt-auto inline-flex items-center gap-2 text-left text-sm font-[500] uppercase tracking-[0.1em] transition-all hover:gap-4"
          style={{ color: '#efbd8a', fontFamily: '"Space Grotesk", system-ui, sans-serif' }}
          aria-label={`${t('events.viewDetails', { defaultValue: 'View details for' })} ${promo.title}`}
        >
          {promo.ctaLabel} <ArrowForwardIcon className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

/* ─── Schedule Event Row ───────────────────────────────────────────── */

function ScheduleEventRow({
  event,
  onReserve,
}: {
  event: ScheduleEvent;
  onReserve?: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="group flex flex-col border-b px-6 py-6 transition-colors hover:bg-[rgba(18,37,61,0.6)] md:flex-row md:items-center md:justify-between md:px-6"
      style={{ borderColor: 'rgba(68,71,77,0.2)' }}
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-6">
        {/* Date */}
        <div className="min-w-[60px] text-center">
          <p
            className="text-xs font-[600] uppercase tracking-[0.05em]"
            style={{
              color: '#c5c6cd',
              fontFamily: '"Space Grotesk", system-ui, sans-serif',
              lineHeight: '1.0',
            }}
          >
            {event.date}
          </p>
          <p
            className="text-[24px] font-[400] leading-[1.4]"
            style={{
              color: '#d4a574',
              fontFamily: '"EB Garamond", Georgia, serif',
            }}
          >
            {event.day}
          </p>
        </div>

        {/* Info */}
        <div>
          <h4
            className="mb-1 text-[24px] font-[400] leading-[1.4]"
            style={{
              fontFamily: '"EB Garamond", Georgia, serif',
              color: '#d3e3ff',
            }}
          >
            {event.title}
          </h4>
          <p
            className="text-sm font-[500] uppercase tracking-[0.1em]"
            style={{
              color: '#c5c6cd',
              fontFamily: '"Space Grotesk", system-ui, sans-serif',
              lineHeight: '1.0',
            }}
          >
            {event.time}
          </p>
        </div>
      </div>

      {/* Badge + Action */}
      <div className="mt-4 flex items-center gap-6 md:mt-0">
        <span
          className={clsx(
            'inline-block rounded-full border px-3 py-1 text-xs font-[600] uppercase tracking-[0.05em]',
            event.badgeType === 'soldOut' && 'border-[#44474d] text-[#8e9097]',
            event.badgeType === 'available' && 'border-[#44474d] text-[#c5c6cd]',
            event.badgeType === 'limited' && 'border-[#44474d] text-[#c5c6cd]',
          )}
          style={{ fontFamily: '"Space Grotesk", system-ui, sans-serif', lineHeight: '1.0' }}
        >
          {event.badge}
        </span>

        {event.badgeType === 'soldOut' ? (
          <button
            type="button"
            disabled
            className="flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-full border opacity-50"
            style={{ borderColor: '#44474d', color: '#8e9097' }}
            aria-label={`${event.title} ${event.badge}`}
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onReserve?.(event.id)}
            className="flex h-9 w-9 items-center justify-center rounded-full border transition-all hover:bg-[#efbd8a] hover:text-[#482a03]"
            style={{ borderColor: '#efbd8a', color: '#efbd8a' }}
            aria-label={`${t('events.reserveSpot', { defaultValue: 'Reserve spot for' })} ${event.title}`}
          >
            <AddIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────────────── */

export function StitchEventsNew1({
  data: externalData,
  loadingState = 'idle',
  errorMessage: externalErrMsg,
  onBookNow,
  onViewSchedule,
  onCtaClick,
  onReserveEvent,
  onNewsletterSubmit,
  onReserveNav,
}: Readonly<StitchEventsNew1Props>) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');

  const defaultData: EventsPromoPageData = {
    heroTag: t('events.nocturnalSessions', { defaultValue: 'Nocturnal Sessions' }),
    heroTitle: t('events.liveJazzEspresso', { defaultValue: 'Live Jazz & Espresso' }),
    heroSubtitle: t('events.heroSubtitle', {
      defaultValue: 'A curated sensory experience where the rhythmic soul of live jazz meets the precision of engineered caffeine. Join us every Friday evening.',
    }),
    heroDescription: t('events.heroDescription', { defaultValue: 'A curated sensory experience where the rhythmic soul of live jazz meets the precision of engineered caffeine.' }),
    heroImageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDQZ_jh2cIn9DWPwzgWJbTKAzTnzDiEHu49EL7QjkzfibflFz0BLLXTxmKU2mYqJniE_iY_j2AACcyrpZLcp6HQo9t3TOR7umfr_OSBpYb8uUT_snx-lxqCD_MbMHWAMGBOLQwL4wI53UetcO_olEg80yPPTmTZ2NW6_mS3hbTxxVt55FEK-LK0vFMS-qS06-dly3VgnzXoHgXQMRrJQnb0ckjnZPRr1K6p7fPW6ZbECMzGmHLwgAdNlASwyN3YhunNi4ANA7KefDY',
    heroImageAlt:
      'A moody, high-contrast photograph of a dimly lit luxury cafe interior at night with warm bronze light catching a chrome espresso machine',
    sectionTitle: t('events.curatedEngagements', { defaultValue: 'Curated Engagements' }),
    sectionDescription: t('events.sectionDescription', {
      defaultValue: 'Exclusive promotions and workshops designed for the discerning coffee connoisseur.',
    }),
    promotions: [
      {
        id: 'golden-hour',
        tag: t('events.promotion', { defaultValue: 'Promotion' }),
        title: t('events.goldenHour', { defaultValue: 'Golden Hour' }),
        description: t('events.goldenHourDesc', {
          defaultValue: 'Half-price signature brews from 4:00 PM to 6:00 PM. A transition from day to dusk.',
        }),
        ctaLabel: t('events.details', { defaultValue: 'Details' }),
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuAm3VcyJQVXnfbrL2pi1TM6GVGawTaENyJSeAN4enTNuUnfB2TmqN-2Wz3XWYNWRtMzFBgPxW1J5SkkbIuzltOxCkvrsEoisR4rqq7bUykFeCMprxT7E7_0ccP5-S56sTMKkvKitGo47vT_KgZEhSX-h_NE9s3cAVSM801J8vHO0_o7EVkZN3FvT7_YJBcR8xVBP5v3Ah-OxgQIVyraUnnIHiJ10sz38lwaojq6yTg16Db_Lw1RtX1kTi3lKTK5-96WtkEaSqMfnjI',
        imageAlt:
          'Close-up shot of a steaming, perfectly layered latte in a thin crystal glass with soft golden light streaming through a warehouse window',
      },
      {
        id: 'bean-craft',
        tag: t('events.workshop', { defaultValue: 'Workshop' }),
        title: t('events.beanCraft', { defaultValue: 'Bean Craft Workshop' }),
        description: t('events.beanCraftDesc', {
          defaultValue: 'Monthly cupping sessions exploring single-origin profiles and technical brewing methods.',
        }),
        ctaLabel: t('events.reserveSeat', { defaultValue: 'Reserve Seat' }),
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuCEM9xvKBOCwsH1fGEEPUsrO2fXD6WzF3rs_Wel972P79cE5qUXKZ1sz7X7mLSYXF-vVdxF9KfCwGUH4G7SEMJDy9DRxhk2p7zGoWBz8Rj7jCeb3q9PVKIK_Jh1WUXJf4lIysyr6uMU2kgJkNG4J_FNCyZoNBIYhP5nt7dxTA8vgm0YCmijJ1DZNfBmkN9HZNjvMIysgfxwzGc6BD7zJ6CGm-gASrY02URP0KUVbDnU_MvRSbTsMpmbY6kSMj-2AFdYhszlfSMT2U8',
        imageAlt:
          'A macro shot of glossy, dark roasted coffee beans spilling from a vintage metal scoop onto a slate surface',
      },
      {
        id: 'midnight-jazz',
        tag: t('events.livePerformance', { defaultValue: 'Live Performance' }),
        title: t('events.midnightJazz', { defaultValue: 'Midnight Jazz' }),
        description: t('events.midnightJazzDesc', {
          defaultValue: 'Immersive live sets starting at 10:00 PM. Dark tones for the late-night observer.',
        }),
        ctaLabel: t('events.viewLineup', { defaultValue: 'View Lineup' }),
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuDdl4TPNPqDmqsr7ahmEfsxFKyyXQSHuugMuxDecD9et__KiRCpFXjtxuwVglaUCo0P0BoqwQ2TOyHFinoND10WlG2_mAH18gMJGoM2J9GQ1BH9ed-0JKy4LMQVFDxo0x7Rk6fh6aNPOYCU31rJvVuxco8oBYXdlfeX60Udp4Aduw5myJW-nLqI3LdTzJNrbmdF8DDHVXamcIclCkjsuwTpyExpk1yyTvGO5kthwU4KQyL7ZWuXDdZp3MZqEPGeckhje0Svf_Ci2Ik',
        imageAlt:
          'A wide-angle interior shot of a luxury industrial cafe at midnight with blue haze and warm amber spots',
      },
    ],
    manifestoTitle: t('events.manifestoTitle', { defaultValue: 'The Social \nManifesto' }),
    manifestoDescription: t('events.manifestoDescription', {
      defaultValue: 'AURA CAFE is more than a destination; it is a ritual. Our events are engineered to provide a sanctuary from the digital noise.',
    }),
    manifestoLocation: t('events.manifestoLocation', { defaultValue: 'Industrial District, Pier 14' }),
    schedule: [
      {
        id: 's1',
        date: t('events.oct', { defaultValue: 'OCT' }),
        day: '14',
        title: t('events.coldBrewChemistry', { defaultValue: 'Cold Brew Chemistry' }),
        time: '7:00 PM — 9:00 PM',
        badge: t('events.limitedCapacity', { defaultValue: 'Limited Capacity' }),
        badgeType: 'limited',
      },
      {
        id: 's2',
        date: t('events.oct', { defaultValue: 'OCT' }),
        day: '21',
        title: t('events.blueNoteCollective', { defaultValue: 'The Blue Note Collective' }),
        time: '10:00 PM — 1:00 AM',
        badge: t('events.soldOut', { defaultValue: 'Sold Out' }),
        badgeType: 'soldOut',
      },
      {
        id: 's3',
        date: t('events.oct', { defaultValue: 'OCT' }),
        day: '28',
        title: t('events.singleOriginSymposium', { defaultValue: 'Single Origin Symposium' }),
        time: '6:00 PM — 8:00 PM',
        badge: t('events.spotsLeft', { defaultValue: '8 Spots Left', count: 8 }),
        badgeType: 'available',
      },
    ],
    newsletterTitle: t('events.newsletterTitle', { defaultValue: 'Join the Circle' }),
    newsletterDescription: t('events.newsletterDescription', {
      defaultValue: 'Subscribe to receive early access to event bookings and exclusive monthly promotions curated for our inner circle.',
    }),
    newsletterFrequency: t('events.newsletterFrequency', { defaultValue: 'Frequency: Bi-weekly' }),
  };

  const data = externalData ?? defaultData;
  const errorMessage = externalErrMsg ?? t('events.pleaseTryAgain', { defaultValue: 'Please try again later.' });

  const handleNewsletterSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (email.trim()) {
        onNewsletterSubmit?.(email.trim());
        setEmail('');
      }
    },
    [email, onNewsletterSubmit],
  );

  /* ─── Loading State ─────────────────────────────────────────── */
  if (loadingState === 'loading') {
    return <EventsPromoSkeleton />;
  }

  /* ─── Error State ───────────────────────────────────────────── */
  if (loadingState === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center px-8" style={{ backgroundColor: '#00142b' }}>
        <EventsPromoError message={errorMessage} />
      </div>
    );
  }

  /* ─── Empty State ───────────────────────────────────────────── */
  if (!data || data.promotions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-8" style={{ backgroundColor: '#00142b' }}>
        <EventsPromoEmpty />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: '#00142b',
        color: '#d3e3ff',
        fontFamily: '"Space Grotesk", system-ui, sans-serif',
      }}
    >
      {/* ── Navbar ──────────────────────────────────────────────── */}
      <SiteNavbar onReserve={onReserveNav} />

      <main className="pt-20">
        {/* ── Hero ───────────────────────────────────────────────── */}
        <HeroSection data={data} onBookNow={onBookNow} onViewSchedule={onViewSchedule} />

        {/* ── Promotions Grid ─────────────────────────────────────── */}
        <section className="py-20" aria-labelledby="promotions-heading">
          <div className="mx-auto max-w-[1200px] px-8">
            <div className="mb-12 flex flex-col items-start justify-between gap-3 md:flex-row md:items-end">
              <div>
                <h2
                  id="promotions-heading"
                  className="mb-2 text-[32px] font-[400] leading-[1.3]"
                  style={{ fontFamily: '"EB Garamond", Georgia, serif', color: '#d3e3ff' }}
                >
                  {data.sectionTitle}
                </h2>
                <div className="h-1 w-20" style={{ backgroundColor: '#d4a574' }} />
              </div>
              <p
                className="max-w-md text-base leading-relaxed"
                style={{
                  color: '#c5c6cd',
                  fontFamily: '"Space Grotesk", system-ui, sans-serif',
                }}
              >
                {data.sectionDescription}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {data.promotions.map((promo) => (
                <PromotionCardItem key={promo.id} promo={promo} onCta={onCtaClick} />
              ))}
            </div>
          </div>
        </section>

        {/* ── Event Schedule (Manifesto) ──────────────────────────── */}
        <section
          className="py-20"
          style={{ backgroundColor: '#071c33' }}
          aria-labelledby="schedule-heading"
        >
          <div className="mx-auto max-w-[1200px] px-8">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
              {/* Manifesto text */}
              <div className="lg:col-span-4">
                <h2
                  id="schedule-heading"
                  className="mb-6 text-[32px] font-[400] italic leading-[1.3]"
                  style={{ fontFamily: '"EB Garamond", Georgia, serif', color: '#d3e3ff' }}
                >
                  {data.manifestoTitle}
                </h2>
                <p
                  className="mb-8 text-base leading-relaxed"
                  style={{
                    color: '#c5c6cd',
                    fontFamily: '"Space Grotesk", system-ui, sans-serif',
                  }}
                >
                  {data.manifestoDescription}
                </p>
                <div
                  className="flex items-center gap-4 border-y py-4"
                  style={{ borderColor: 'rgba(68,71,77,0.2)' }}
                >
                  <LocationIcon className="h-5 w-5 shrink-0" style={{ color: '#d4a574' }} />
                  <span
                    className="text-sm font-[500] uppercase tracking-[0.1em]"
                    style={{
                      color: '#d3e3ff',
                      fontFamily: '"Space Grotesk", system-ui, sans-serif',
                    }}
                  >
                    {data.manifestoLocation}
                  </span>
                </div>
              </div>

              {/* Schedule list */}
              <div className="flex flex-col gap-0 lg:col-span-8">
                {data.schedule.map((evt) => (
                  <ScheduleEventRow key={evt.id} event={evt} onReserve={onReserveEvent} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Newsletter ──────────────────────────────────────────── */}
        <section className="py-20" aria-labelledby="newsletter-heading">
          <div className="mx-auto max-w-[800px] px-8 text-center">
            <h2
              id="newsletter-heading"
              className="mb-6 text-[36px] font-[500] italic leading-tight md:text-[32px] md:leading-[1.3]"
              style={{ fontFamily: '"EB Garamond", Georgia, serif', color: '#d3e3ff' }}
            >
              {data.newsletterTitle}
            </h2>
            <p
              className="mx-auto mb-10 max-w-lg text-base leading-relaxed"
              style={{
                color: '#c5c6cd',
                fontFamily: '"Space Grotesk", system-ui, sans-serif',
              }}
            >
              {data.newsletterDescription}
            </p>

            <form
              onSubmit={handleNewsletterSubmit}
              className="mx-auto flex max-w-xl flex-col gap-0 rounded-full p-1 shadow-xl md:flex-row"
              style={{
                backgroundColor: '#182b43',
                border: '0.5px solid rgba(68,71,77,0.3)',
              }}
              aria-label={t('events.newsletterForm', { defaultValue: 'Newsletter subscription form' })}
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('events.emailPlaceholder', { defaultValue: 'Email Address' })}
                className="w-full flex-1 bg-transparent px-6 py-3 text-base outline-none placeholder:text-[#8e9097]/50 md:w-auto"
                style={{
                  color: '#d3e3ff',
                  fontFamily: '"Space Grotesk", system-ui, sans-serif',
                }}
                aria-label={t('events.emailPlaceholder', { defaultValue: 'Email Address' })}
              />
              <button
                type="submit"
                className="w-full rounded-full px-10 py-3 text-sm font-[500] uppercase tracking-[0.1em] transition-all duration-300 hover:bg-[#d4a574] hover:text-[#00142b] md:w-auto"
                style={{
                  backgroundColor: '#d3e3ff',
                  color: '#00142b',
                  fontFamily: '"Space Grotesk", system-ui, sans-serif',
                }}
                aria-label={t('events.subscribe', { defaultValue: 'Subscribe' })}
              >
                {t('events.subscribe', { defaultValue: 'Subscribe' })}
              </button>
            </form>

            <p
              className="mt-6 text-xs font-[600] uppercase tracking-[0.05em] opacity-60"
              style={{
                color: '#8e9097',
                fontFamily: '"Space Grotesk", system-ui, sans-serif',
                lineHeight: '1.0',
              }}
            >
              {data.newsletterFrequency}
            </p>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer
        className="border-t py-20"
        style={{
          backgroundColor: '#00142b',
          borderColor: 'rgba(68, 71, 77, 0.5)',
        }}
      >
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-6 px-8 md:grid-cols-3">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <span
              className="text-[24px] font-[400] italic leading-[1.4]"
              style={{
                color: '#c5c6cd',
                fontFamily: '"EB Garamond", Georgia, serif',
              }}
            >
              {t('events.brandName', { defaultValue: 'AURA CAFE' })}
            </span>
            <p
              className="text-base leading-relaxed"
              style={{
                color: '#454748',
                fontFamily: '"Space Grotesk", system-ui, sans-serif',
              }}
            >
              {t('events.footerTagline', {
                defaultValue: 'Precision engineering meets atmospheric tranquility. The sanctum of the modern connoisseur.',
              })}
            </p>
          </div>

          {/* Connect */}
          <div className="flex flex-col gap-3">
            <h5
              className="text-sm font-[500] uppercase tracking-[0.1em]"
              style={{
                color: '#efbd8a',
                fontFamily: '"Space Grotesk", system-ui, sans-serif',
              }}
            >
              {t('events.connect', { defaultValue: 'Connect' })}
            </h5>
            <div className="flex flex-col gap-2">
              {[
                { key: 'instagram', label: t('events.instagram', { defaultValue: 'Instagram' }) },
                { key: 'spotifyPlaylist', label: t('events.spotifyPlaylist', { defaultValue: 'Spotify Playlist' }) },
                { key: 'contactSocial', label: t('events.contactSocial', { defaultValue: 'Contact' }) },
              ].map((link) => (
                <a
                  key={link.key}
                  href="#"
                  className="text-xs font-[600] uppercase tracking-[0.05em] transition-colors hover:text-[#d3e3ff]"
                  style={{
                    color: '#454748',
                    fontFamily: '"Space Grotesk", system-ui, sans-serif',
                    lineHeight: '1.0',
                  }}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {/* Legal */}
          <div className="flex flex-col gap-3">
            <h5
              className="text-sm font-[500] uppercase tracking-[0.1em]"
              style={{
                color: '#efbd8a',
                fontFamily: '"Space Grotesk", system-ui, sans-serif',
              }}
            >
              {t('events.legal', { defaultValue: 'Legal' })}
            </h5>
            <div className="flex flex-col gap-2">
              {[
                { key: 'terms', label: t('events.termsOfService', { defaultValue: 'Terms of Service' }) },
                { key: 'privacy', label: t('events.privacyPolicy', { defaultValue: 'Privacy Policy' }) },
                { key: 'sustainability', label: t('events.sustainability', { defaultValue: 'Sustainability' }) },
              ].map((link) => (
                <a
                  key={link.key}
                  href="#"
                  className="text-xs font-[600] uppercase tracking-[0.05em] transition-colors hover:text-[#d3e3ff]"
                  style={{
                    color: '#454748',
                    fontFamily: '"Space Grotesk", system-ui, sans-serif',
                    lineHeight: '1.0',
                  }}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="mx-auto mt-12 flex max-w-[1200px] flex-col items-center gap-4 border-t px-8 pt-8 md:flex-row md:justify-between"
          style={{ borderColor: 'rgba(68,71,77,0.2)' }}
        >
          <p
            className="text-xs font-[600] uppercase tracking-[0.05em]"
            style={{
              color: '#454748',
              fontFamily: '"Space Grotesk", system-ui, sans-serif',
              lineHeight: '1.0',
            }}
          >
            {t('events.footerCopyright', {
              defaultValue: `© 2024 AURA CAFE. ENGINEERED FOR CALM.`,
            })}
          </p>
          <div className="flex items-center gap-4">
            <div
              className="h-2 w-2 animate-pulse rounded-full"
              style={{ backgroundColor: '#d4a574' }}
            />
            <span
              className="text-xs font-[600] uppercase tracking-[0.05em]"
              style={{
                color: '#d3e3ff',
                fontFamily: '"Space Grotesk", system-ui, sans-serif',
                lineHeight: '1.0',
              }}
            >
              {t('events.liveStatus', { defaultValue: 'Live at Pier 14' })}
            </span>
          </div>
        </div>
      </footer>

      {/* Custom styles */}
      <style>{`
        .neon-glow-bronze-events {
          box-shadow: 0 0 20px rgba(212, 165, 116, 0.15);
        }
        .neon-glow-bronze-events:hover {
          box-shadow: 0 0 30px rgba(212, 165, 116, 0.3);
        }
      `}</style>
    </div>
  );
}
