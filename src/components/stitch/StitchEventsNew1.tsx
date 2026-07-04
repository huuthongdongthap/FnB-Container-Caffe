/**
 * StitchEventsNew1 — AURA CAFE Events & Promotions (Stitch design, New v1)
 *
 * Dark navy glassmorphism events/promotions landing with hero section,
 * promotion cards grid, event schedule manifesto, and newsletter CTA.
 * Mobile-first responsive. Named export.
 * Source: Stitch AI aura_cafe_events_promotions_1/code.html export.
 *
 * Stitch design tokens (--st-*) applied: 2026-07-04
 * - All hardcoded hex colors replaced with CSS custom properties
 * - color-mix() used for opacity variants
 */
'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { ArrowRight, Plus, X, MapPin } from 'lucide-react';

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

/* ─── Loading Skeleton ─────────────────────────────────────────────── */

function EventsPromoSkeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--st-surface-dim)' }}>
      {/* Nav skeleton */}
      <div className="fixed top-0 left-0 w-full z-50" style={{ backgroundColor: 'color-mix(in srgb, var(--st-surface-container-low) 60%, transparent)', backdropFilter: 'blur(12px)' }}>
        <div className="mx-auto flex h-20 max-w-[1200px] items-center justify-between px-8">
          <div className="h-6 w-32 animate-pulse rounded" style={{ backgroundColor: 'var(--st-surface-container-high)' }} />
          <div className="hidden gap-12 md:flex">
            <div className="h-4 w-14 animate-pulse rounded" style={{ backgroundColor: 'var(--st-surface-container-high)' }} />
            <div className="h-4 w-14 animate-pulse rounded" style={{ backgroundColor: 'var(--st-surface-container-high)' }} />
            <div className="h-4 w-14 animate-pulse rounded" style={{ backgroundColor: 'var(--st-surface-container-high)' }} />
            <div className="h-4 w-16 animate-pulse rounded" style={{ backgroundColor: 'var(--st-surface-container-high)' }} />
          </div>
          <div className="h-10 w-28 animate-pulse rounded-full" style={{ backgroundColor: 'var(--st-surface-container-high)' }} />
        </div>
      </div>

      {/* Hero skeleton */}
      <div className="mx-auto max-w-[1200px] px-8 pt-20">
        <div className="mb-16 min-h-[600px] md:min-h-[870px]">
          <div className="mx-auto max-w-lg space-y-4 pt-40 text-center">
            <div className="mx-auto h-4 w-40 animate-pulse rounded" style={{ backgroundColor: 'var(--st-surface-container-high)' }} />
            <div className="mx-auto h-16 w-3/4 animate-pulse rounded" style={{ backgroundColor: 'var(--st-surface-container-high)' }} />
            <div className="mx-auto h-4 w-full animate-pulse rounded" style={{ backgroundColor: 'var(--st-surface-container-high)' }} />
            <div className="mx-auto h-4 w-1/2 animate-pulse rounded" style={{ backgroundColor: 'var(--st-surface-container-high)' }} />
            <div className="flex justify-center gap-6">
              <div className="h-14 w-40 animate-pulse" style={{ backgroundColor: 'var(--st-surface-container-high)' }} />
              <div className="h-14 w-40 animate-pulse" style={{ backgroundColor: 'var(--st-surface-container-high)' }} />
            </div>
          </div>
        </div>
        {/* Grid skeleton */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-96 animate-pulse" style={{ backgroundColor: 'color-mix(in srgb, var(--st-surface-container-high) 80%, transparent)' }} />
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
      style={{ backgroundColor: 'var(--st-surface-dim)' }}
    >
      <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="var(--st-error)" strokeWidth={1.5} aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      <h3
        className="text-xl font-semibold"
        style={{
          fontFamily: '"EB Garamond", Georgia, serif',
          color: 'var(--st-on-surface)',
        }}
      >
        {t('events.unableToLoad', { defaultValue: 'Unable to load events' })}
      </h3>
      <p style={{ color: 'var(--st-on-surface-variant)' }}>{message}</p>
    </div>
  );
}

/* ─── Empty State ──────────────────────────────────────────────────── */

function EventsPromoEmpty() {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8 text-center"
      style={{ backgroundColor: 'var(--st-surface-dim)' }}
    >
      <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="var(--st-outline)" strokeWidth={1.5} aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
      <h3
        className="text-xl font-semibold"
        style={{
          fontFamily: '"EB Garamond", Georgia, serif',
          color: 'var(--st-on-surface)',
        }}
      >
        {t('events.noUpcomingEvents', { defaultValue: 'No upcoming events' })}
      </h3>
      <p style={{ color: 'var(--st-on-surface-variant)' }}>{t('events.checkBackSoon', { defaultValue: 'Check back soon for new listings.' })}</p>
    </div>
  );
}

/* ─── Navbar ───────────────────────────────────────────────────────── */

function SiteNavbar({ onReserve }: { onReserve?: () => void }) {
  const { t } = useTranslation();
  return (
    <nav className="fixed top-0 left-0 w-full z-50 border-b backdrop-blur-md"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--st-surface-container-low) 60%, transparent)',
        borderColor: 'color-mix(in srgb, var(--st-outline-variant) 30%, transparent)',
      }}
    >
      <div className="mx-auto flex h-20 max-w-[1200px] items-center justify-between px-8">
        <a
          href="#"
          className="uppercase tracking-widest"
          style={{
            fontFamily: '"EB Garamond", Georgia, serif',
            fontSize: '32px',
            lineHeight: '1.3',
            fontWeight: 400,
            color: 'var(--st-on-surface)',
          }}
        >
          {t('events.brandName', { defaultValue: 'AURA CAFE' })}
        </a>

        <div className="hidden md:flex items-center gap-12">
          <a
            href="#"
            className="transition-colors duration-300 hover:text-[var(--st-on-surface)] uppercase tracking-[0.1em]"
            style={{
              fontFamily: '"Space Grotesk", system-ui, sans-serif',
              fontSize: '14px',
              lineHeight: '1.0',
              fontWeight: 500,
              letterSpacing: '0.1em',
              color: 'var(--st-on-surface-variant)',
            }}
          >
            {t('events.navVessels', { defaultValue: 'Vessels' })}
          </a>
          <a
            href="#"
            className="border-b pb-1 uppercase tracking-[0.1em]"
            style={{
              fontFamily: '"Space Grotesk", system-ui, sans-serif',
              fontSize: '14px',
              lineHeight: '1.0',
              fontWeight: 500,
              letterSpacing: '0.1em',
              borderColor: 'var(--st-secondary)',
              color: 'var(--st-secondary)',
            }}
          >
            {t('events.navEvents', { defaultValue: 'Events' })}
          </a>
          <a
            href="#"
            className="transition-colors duration-300 hover:text-[var(--st-on-surface)] uppercase tracking-[0.1em]"
            style={{
              fontFamily: '"Space Grotesk", system-ui, sans-serif',
              fontSize: '14px',
              lineHeight: '1.0',
              fontWeight: 500,
              letterSpacing: '0.1em',
              color: 'var(--st-on-surface-variant)',
            }}
          >
            {t('events.navJournal', { defaultValue: 'Journal' })}
          </a>
          <a
            href="#"
            className="transition-colors duration-300 hover:text-[var(--st-on-surface)] uppercase tracking-[0.1em]"
            style={{
              fontFamily: '"Space Grotesk", system-ui, sans-serif',
              fontSize: '14px',
              lineHeight: '1.0',
              fontWeight: 500,
              letterSpacing: '0.1em',
              color: 'var(--st-on-surface-variant)',
            }}
          >
            {t('events.navLocation', { defaultValue: 'Location' })}
          </a>
        </div>

        <button
          type="button"
          onClick={onReserve}
          className="rounded-full px-6 py-2 uppercase tracking-[0.1em] transition-all duration-300 hover:scale-105 active:scale-95 neon-glow-bronze"
          style={{
            backgroundColor: 'var(--st-secondary)',
            color: 'var(--st-on-secondary)',
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontSize: '14px',
            lineHeight: '1.0',
            fontWeight: 500,
            letterSpacing: '0.1em',
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
      className="relative h-[870px] flex items-center justify-center overflow-hidden"
      aria-label={t('events.featured', { defaultValue: 'Featured Event' })}
    >
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <div
          className="w-full h-full bg-cover bg-center transition-transform duration-[10s] hover:scale-110"
          style={{ backgroundImage: `url(${data.heroImageUrl})` }}
          role="img"
          aria-label={data.heroImageAlt}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--st-surface-dim)] via-[var(--st-surface-dim)]/40 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-[1200px] mx-auto px-8 text-center">
        <span
          className="mb-4 block uppercase tracking-[0.3em]"
          style={{
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontSize: '14px',
            lineHeight: '1.0',
            fontWeight: 500,
            letterSpacing: '0.3em',
            color: 'var(--st-secondary)',
          }}
        >
          {data.heroTag}
        </span>
        <h1
          className="mx-auto mb-8 max-w-4xl italic leading-tight"
          style={{
            fontFamily: '"EB Garamond", Georgia, serif',
            fontSize: '36px',
            lineHeight: '1.2',
            fontWeight: 500,
            color: 'var(--st-on-surface)',
          }}
        >
          {t('events.liveJazzAnd', { defaultValue: 'Live Jazz & ' })}
          <span style={{ color: 'var(--st-secondary)' }}>{t('events.espressoWord', { defaultValue: 'Espresso' })}</span>
        </h1>
        <p
          className="mx-auto mb-10 max-w-xl"
          style={{
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontSize: '18px',
            lineHeight: '1.6',
            fontWeight: 400,
            color: 'var(--st-on-surface-variant)',
          }}
        >
          {data.heroSubtitle}
        </p>
        <div className="flex flex-col md:flex-row gap-6 justify-center items-center">
          <button
            type="button"
            onClick={onBookNow}
            className="w-full md:w-auto px-10 py-4 uppercase tracking-widest transition-all hover:brightness-110 neon-glow-bronze"
            style={{
              backgroundColor: 'var(--st-secondary)',
              color: 'var(--st-surface-dim)',
              fontFamily: '"Space Grotesk", system-ui, sans-serif',
              fontSize: '14px',
              lineHeight: '1.0',
              fontWeight: 500,
              letterSpacing: '0.1em',
            }}
            aria-label={t('events.bookNow', { defaultValue: 'Book Now' })}
          >
            {t('events.bookNow', { defaultValue: 'Book Now' })}
          </button>
          <button
            type="button"
            onClick={onViewSchedule}
            className="w-full md:w-auto border px-10 py-4 uppercase tracking-widest transition-all hover:bg-[var(--st-on-surface-variant)]/10"
            style={{
              borderColor: 'var(--st-on-surface-variant)',
              color: 'var(--st-on-surface-variant)',
              fontFamily: '"Space Grotesk", system-ui, sans-serif',
              fontSize: '14px',
              lineHeight: '1.0',
              fontWeight: 500,
              letterSpacing: '0.1em',
            }}
            aria-label={t('events.viewSchedule', { defaultValue: 'View Schedule' })}
          >
            {t('events.viewSchedule', { defaultValue: 'View Schedule' })}
          </button>
        </div>
      </div>

      {/* Decorative vertical seam */}
      <div className="absolute bottom-0 left-1/2 h-24 w-px -translate-x-1/2 bg-gradient-to-b from-transparent to-[var(--st-outline-variant)]" />
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
        background: 'color-mix(in srgb, var(--st-surface-container-high) 80%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '0.5px solid color-mix(in srgb, var(--st-outline-variant) 30%, transparent)',
      }}
      aria-label={promo.title}
    >
      {/* Image */}
      <div className="h-64 overflow-hidden">
        <div
          className="w-full h-full bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
          style={{ backgroundImage: `url(${promo.imageUrl})` }}
          role="img"
          aria-label={promo.imageAlt}
        />
      </div>

      {/* Content */}
      <div className="p-12">
        <span
          className="uppercase tracking-widest"
          style={{
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontSize: '12px',
            lineHeight: '1.0',
            fontWeight: 600,
            letterSpacing: '0.05em',
            color: 'var(--st-secondary)',
          }}
        >
          {promo.tag}
        </span>
        <h3
          className="italic mt-2 mb-4"
          style={{
            fontFamily: '"EB Garamond", Georgia, serif',
            fontSize: '24px',
            lineHeight: '1.4',
            fontWeight: 400,
            color: 'var(--st-on-surface)',
          }}
        >
          {promo.title}
        </h3>
        <p
          className="mb-6"
          style={{
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontSize: '16px',
            lineHeight: '1.6',
            fontWeight: 400,
            color: 'var(--st-on-surface-variant)',
          }}
        >
          {promo.description}
        </p>
        <button
          type="button"
          onClick={() => onCta?.(promo.id)}
          className="inline-flex items-center gap-2 uppercase tracking-[0.1em] transition-all hover:gap-4"
          style={{
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontSize: '14px',
            lineHeight: '1.0',
            fontWeight: 500,
            letterSpacing: '0.1em',
            color: 'var(--st-secondary)',
          }}
          aria-label={`${t('events.viewDetails', { defaultValue: 'View details for' })} ${promo.title}`}
        >
          {promo.ctaLabel} <ArrowRight size={16} />
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
      className="group flex flex-col md:flex-row md:items-center justify-between p-6 border-b transition-colors"
      style={{
        borderColor: 'color-mix(in srgb, var(--st-outline-variant) 20%, transparent)',
      }}
    >
      <div className="flex items-center gap-12">
        {/* Date */}
        <div className="min-w-[60px] text-center">
          <p
            className="uppercase tracking-[0.05em]"
            style={{
              fontFamily: '"Space Grotesk", system-ui, sans-serif',
              fontSize: '12px',
              lineHeight: '1.0',
              fontWeight: 600,
              letterSpacing: '0.05em',
              color: 'var(--st-on-surface-variant)',
            }}
          >
            {event.date}
          </p>
          <p
            style={{
              fontFamily: '"EB Garamond", Georgia, serif',
              fontSize: '24px',
              lineHeight: '1.4',
              fontWeight: 400,
              color: 'var(--st-secondary)',
            }}
          >
            {event.day}
          </p>
        </div>

        {/* Info */}
        <div>
          <h4
            className="mb-1"
            style={{
              fontFamily: '"EB Garamond", Georgia, serif',
              fontSize: '24px',
              lineHeight: '1.4',
              fontWeight: 400,
              color: 'var(--st-on-surface)',
            }}
          >
            {event.title}
          </h4>
          <p
            className="uppercase tracking-[0.1em]"
            style={{
              fontFamily: '"Space Grotesk", system-ui, sans-serif',
              fontSize: '14px',
              lineHeight: '1.0',
              fontWeight: 500,
              letterSpacing: '0.1em',
              color: 'var(--st-on-surface-variant)',
            }}
          >
            {event.time}
          </p>
        </div>
      </div>

      {/* Badge + Action */}
      <div className="mt-4 md:mt-0 flex items-center gap-6">
        <span
          className={clsx(
            'inline-block rounded-full border px-3 py-1 uppercase tracking-[0.05em]',
          )}
          style={{
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontSize: '12px',
            lineHeight: '1.0',
            fontWeight: 600,
            letterSpacing: '0.05em',
            borderColor: 'var(--st-outline-variant)',
            color: event.badgeType === 'soldOut' ? 'var(--st-outline)' : 'var(--st-on-surface-variant)',
          }}
        >
          {event.badge}
        </span>

        {event.badgeType === 'soldOut' ? (
          <button
            type="button"
            disabled
            className="p-2 border rounded-full cursor-not-allowed opacity-50"
            style={{
              borderColor: 'var(--st-outline-variant)',
              color: 'var(--st-outline)',
            }}
            aria-label={`${event.title} ${event.badge}`}
          >
            <X size={16} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onReserve?.(event.id)}
            className="p-2 border rounded-full transition-all hover:bg-[var(--st-secondary)] hover:text-[var(--st-on-secondary)]"
            style={{
              borderColor: 'var(--st-secondary)',
              color: 'var(--st-secondary)',
            }}
            aria-label={`${t('events.reserveSpot', { defaultValue: 'Reserve spot for' })} ${event.title}`}
          >
            <Plus size={16} />
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
      <div className="flex min-h-screen items-center justify-center px-8" style={{ backgroundColor: 'var(--st-surface-dim)' }}>
        <EventsPromoError message={errorMessage} />
      </div>
    );
  }

  /* ─── Empty State ───────────────────────────────────────────── */
  if (!data || data.promotions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-8" style={{ backgroundColor: 'var(--st-surface-dim)' }}>
        <EventsPromoEmpty />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: 'var(--st-surface-dim)',
        color: 'var(--st-on-surface)',
        fontFamily: '"Space Grotesk", system-ui, sans-serif',
      }}
    >
      {/* ── Navbar ──────────────────────────────────────────────── */}
      <SiteNavbar onReserve={onReserveNav} />

      <main className="pt-20">
        {/* ── Hero ───────────────────────────────────────────────── */}
        <HeroSection data={data} onBookNow={onBookNow} onViewSchedule={onViewSchedule} />

        {/* ── Promotions Grid ─────────────────────────────────────── */}
        <section className="py-20 max-w-[1200px] mx-auto px-8" aria-labelledby="promotions-heading">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-3">
            <div>
              <h2
                id="promotions-heading"
                className="mb-2"
                style={{
                  fontFamily: '"EB Garamond", Georgia, serif',
                  fontSize: '32px',
                  lineHeight: '1.3',
                  fontWeight: 400,
                  color: 'var(--st-on-surface)',
                }}
              >
                {data.sectionTitle}
              </h2>
              <div className="h-1 w-20" style={{ backgroundColor: 'var(--st-secondary)' }} />
            </div>
            <p
              className="max-w-md"
              style={{
                fontFamily: '"Space Grotesk", system-ui, sans-serif',
                fontSize: '16px',
                lineHeight: '1.6',
                fontWeight: 400,
                color: 'var(--st-on-surface-variant)',
              }}
            >
              {data.sectionDescription}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {data.promotions.map((promo) => (
              <PromotionCardItem key={promo.id} promo={promo} onCta={onCtaClick} />
            ))}
          </div>
        </section>

        {/* ── Event Schedule / Manifesto ───────────────────────────── */}
        <section
          className="py-20"
          style={{ backgroundColor: 'var(--st-surface-dim)' }}
          aria-labelledby="schedule-heading"
        >
          <div className="max-w-[1200px] mx-auto px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-20">
              {/* Manifesto text */}
              <div className="lg:col-span-4">
                <h2
                  id="schedule-heading"
                  className="mb-6 italic"
                  style={{
                    fontFamily: '"EB Garamond", Georgia, serif',
                    fontSize: '32px',
                    lineHeight: '1.3',
                    fontWeight: 400,
                    color: 'var(--st-on-surface)',
                  }}
                >
                  {data.manifestoTitle}
                </h2>
                <p
                  className="mb-8"
                  style={{
                    fontFamily: '"Space Grotesk", system-ui, sans-serif',
                    fontSize: '16px',
                    lineHeight: '1.6',
                    fontWeight: 400,
                    color: 'var(--st-on-surface-variant)',
                  }}
                >
                  {data.manifestoDescription}
                </p>
                <div
                  className="flex items-center gap-4 py-4 border-y"
                  style={{ borderColor: 'color-mix(in srgb, var(--st-outline-variant) 20%, transparent)' }}
                >
                  <MapPin size={20} style={{ color: 'var(--st-secondary)' }} />
                  <span
                    className="tracking-wider uppercase"
                    style={{
                      fontFamily: '"Space Grotesk", system-ui, sans-serif',
                      fontSize: '14px',
                      lineHeight: '1.0',
                      fontWeight: 500,
                      letterSpacing: '0.1em',
                      color: 'var(--st-on-surface)',
                    }}
                  >
                    {data.manifestoLocation}
                  </span>
                </div>
              </div>

              {/* Schedule list */}
              <div className="lg:col-span-8 flex flex-col gap-0">
                {data.schedule.map((evt) => (
                  <ScheduleEventRow key={evt.id} event={evt} onReserve={onReserveEvent} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Newsletter ──────────────────────────────────────────── */}
        <section className="py-20" aria-labelledby="newsletter-heading">
          <div className="max-w-[800px] mx-auto px-8 text-center">
            <h2
              id="newsletter-heading"
              className="mb-6 italic"
              style={{
                fontFamily: '"EB Garamond", Georgia, serif',
                fontSize: '36px',
                lineHeight: '1.2',
                fontWeight: 500,
                color: 'var(--st-on-surface)',
              }}
            >
              {data.newsletterTitle}
            </h2>
            <p
              className="mx-auto mb-10 max-w-lg"
              style={{
                fontFamily: '"Space Grotesk", system-ui, sans-serif',
                fontSize: '16px',
                lineHeight: '1.6',
                fontWeight: 400,
                color: 'var(--st-on-surface-variant)',
              }}
            >
              {data.newsletterDescription}
            </p>

            <form
              onSubmit={handleNewsletterSubmit}
              className="mx-auto flex max-w-xl flex-col md:flex-row gap-1 items-center justify-center p-1 rounded-full border shadow-xl"
              style={{
                backgroundColor: 'var(--st-surface-container)',
                borderColor: 'color-mix(in srgb, var(--st-outline-variant) 30%, transparent)',
              }}
              aria-label={t('events.newsletterForm', { defaultValue: 'Newsletter subscription form' })}
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('events.emailPlaceholder', { defaultValue: 'Email Address' })}
                className="w-full md:flex-1 bg-transparent border-none focus:ring-0 px-6 py-3 placeholder:text-[var(--st-outline)]/50"
                style={{
                  color: 'var(--st-on-surface)',
                  fontFamily: '"Space Grotesk", system-ui, sans-serif',
                  fontSize: '16px',
                  lineHeight: '1.6',
                  fontWeight: 400,
                }}
                aria-label={t('events.emailPlaceholder', { defaultValue: 'Email Address' })}
              />
              <button
                type="submit"
                className="w-full md:w-auto px-10 py-3 rounded-full uppercase tracking-[0.1em] transition-all duration-300 hover:bg-[var(--st-secondary)] hover:text-[var(--st-surface-dim)]"
                style={{
                  backgroundColor: 'var(--st-on-surface)',
                  color: 'var(--st-surface-dim)',
                  fontFamily: '"Space Grotesk", system-ui, sans-serif',
                  fontSize: '14px',
                  lineHeight: '1.0',
                  fontWeight: 500,
                  letterSpacing: '0.1em',
                }}
                aria-label={t('events.subscribe', { defaultValue: 'Subscribe' })}
              >
                {t('events.subscribe', { defaultValue: 'Subscribe' })}
              </button>
            </form>

            <p
              className="mt-6 uppercase tracking-widest opacity-60"
              style={{
                fontFamily: '"Space Grotesk", system-ui, sans-serif',
                fontSize: '12px',
                lineHeight: '1.0',
                fontWeight: 600,
                letterSpacing: '0.05em',
                color: 'var(--st-outline)',
              }}
            >
              {data.newsletterFrequency}
            </p>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer
        className="border-t py-20 mt-20"
        style={{
          backgroundColor: 'var(--st-surface-dim)',
          borderColor: 'color-mix(in srgb, var(--st-outline-variant) 50%, transparent)',
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-8 max-w-[1200px] mx-auto items-start">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <span
              className="italic"
              style={{
                fontFamily: '"EB Garamond", Georgia, serif',
                fontSize: '24px',
                lineHeight: '1.4',
                fontWeight: 400,
                color: 'var(--st-on-surface-variant)',
              }}
            >
              {t('events.brandName', { defaultValue: 'AURA CAFE' })}
            </span>
            <p
              style={{
                fontFamily: '"Space Grotesk", system-ui, sans-serif',
                fontSize: '16px',
                lineHeight: '1.6',
                fontWeight: 400,
                color: 'var(--st-outline-variant)',
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
              className="uppercase tracking-widest"
              style={{
                fontFamily: '"Space Grotesk", system-ui, sans-serif',
                fontSize: '14px',
                lineHeight: '1.0',
                fontWeight: 500,
                letterSpacing: '0.1em',
                color: 'var(--st-secondary)',
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
                  className="transition-colors hover:text-[var(--st-on-surface)]"
                  style={{
                    fontFamily: '"Space Grotesk", system-ui, sans-serif',
                    fontSize: '12px',
                    lineHeight: '1.0',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    color: 'var(--st-outline-variant)',
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
              className="uppercase tracking-widest"
              style={{
                fontFamily: '"Space Grotesk", system-ui, sans-serif',
                fontSize: '14px',
                lineHeight: '1.0',
                fontWeight: 500,
                letterSpacing: '0.1em',
                color: 'var(--st-secondary)',
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
                  className="transition-colors hover:text-[var(--st-on-surface)]"
                  style={{
                    fontFamily: '"Space Grotesk", system-ui, sans-serif',
                    fontSize: '12px',
                    lineHeight: '1.0',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    color: 'var(--st-outline-variant)',
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
          className="max-w-[1200px] mx-auto px-8 mt-12 pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4"
          style={{ borderColor: 'color-mix(in srgb, var(--st-outline-variant) 20%, transparent)' }}
        >
          <p
            className="uppercase tracking-[0.05em]"
            style={{
              fontFamily: '"Space Grotesk", system-ui, sans-serif',
              fontSize: '12px',
              lineHeight: '1.0',
              fontWeight: 600,
              letterSpacing: '0.05em',
              color: 'var(--st-outline-variant)',
            }}
          >
            {t('events.footerCopyright', {
              defaultValue: '© 2024 AURA CAFE. ENGINEERED FOR CALM.',
            })}
          </p>
          <div className="flex items-center gap-4">
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: 'var(--st-secondary)' }}
            />
            <span
              className="uppercase"
              style={{
                fontFamily: '"Space Grotesk", system-ui, sans-serif',
                fontSize: '12px',
                lineHeight: '1.0',
                fontWeight: 600,
                letterSpacing: '0.05em',
                color: 'var(--st-on-surface)',
              }}
            >
              {t('events.liveStatus', { defaultValue: 'Live at Pier 14' })}
            </span>
          </div>
        </div>
      </footer>

      {/* Custom styles */}
      <style>{`
        .neon-glow-bronze {
          box-shadow: 0 0 20px color-mix(in srgb, var(--st-secondary) 15%, transparent);
        }
        .neon-glow-bronze:hover {
          box-shadow: 0 0 30px color-mix(in srgb, var(--st-secondary) 30%, transparent);
        }
      `}</style>
    </div>
  );
}
