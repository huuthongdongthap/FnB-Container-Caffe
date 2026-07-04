/**
 * StitchEventsNew1 — AURA CAFE Events & Promotions (Stitch design, New v1)
 *
 * Dark navy glassmorphism events/promotions landing with hero section,
 * promotion cards grid, event schedule manifesto, and newsletter CTA.
 * Mobile-first responsive. Named export.
 * Source: Stitch AI aura_cafe_events_promotions_1/code.html export.
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

function LocationIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

/* ─── Loading Skeleton ─────────────────────────────────────────────── */

function EventsPromoSkeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--aura-bg-page, #081425)' }}>
      {/* Hero skeleton */}
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="mb-16 min-h-[500px] rounded-xl p-12" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }}>
          <div className="mx-auto max-w-lg space-y-4 text-center">
            <div className="mx-auto h-4 w-24 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }} />
            <div className="mx-auto h-12 w-3/4 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }} />
            <div className="mx-auto h-4 w-full animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }} />
            <div className="mx-auto h-4 w-1/2 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }} />
            <div className="flex justify-center gap-4">
              <div className="h-12 w-36 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }} />
              <div className="h-12 w-36 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }} />
            </div>
          </div>
        </div>
        {/* Grid skeleton */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-96 animate-pulse rounded-xl" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
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
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      style={{ backgroundColor: 'var(--aura-bg-surface, #0d1b2a)' }}
    >
      <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="#ffb4ab" strokeWidth={1.5} aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      <h3
        className="text-xl font-semibold"
        style={{
          fontFamily: 'var(--aura-font-display, "Libre Caslon Text", Georgia, serif)',
          color: 'var(--aura-text-primary, #e8e8e8)',
        }}
      >
        {t('events.unableToLoad')}
      </h3>
      <p style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>{message}</p>
    </div>
  );
}

/* ─── Empty State ──────────────────────────────────────────────────── */

function EventsPromoEmpty() {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      style={{ backgroundColor: 'var(--aura-bg-surface, #0d1b2a)' }}
    >
      <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="#5a6270" strokeWidth={1.5} aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
      <h3
        className="text-xl font-semibold"
        style={{
          fontFamily: 'var(--aura-font-display, "Libre Caslon Text", Georgia, serif)',
          color: 'var(--aura-text-primary, #e8e8e8)',
        }}
      >
        {t('events.noUpcomingEvents')}
      </h3>
      <p style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>{t('events.checkBackSoon')}</p>
    </div>
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
      className="relative flex min-h-[600px] items-center justify-center overflow-hidden md:min-h-[870px]"
      aria-label={t('events.featured')}
    >
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <div
          className="h-full w-full scale-110 bg-cover bg-center transition-transform duration-[10s] hover:scale-100"
          style={{ backgroundImage: `url(${data.heroImageUrl})` }}
          role="img"
          aria-label={data.heroImageAlt}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, var(--aura-bg-page, #0A1A2E) 0%, rgba(8,20,37,0.4) 50%, transparent 100%)',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-[1280px] px-6 text-center">
        <span className="mb-4 block font-label-caps text-xs tracking-[0.3em] text-[var(--aura-chrome-light)] uppercase">
          {data.heroTag}
        </span>
        <h1
          className="mx-auto mb-8 max-w-4xl text-4xl italic leading-tight text-white md:text-7xl md:leading-tight"
          style={{ fontFamily: 'var(--aura-font-display-serif, "EB Garamond", Georgia, serif)' }}
        >
          {data.heroTitle}
        </h1>
        <p
          className="mx-auto mb-10 max-w-xl text-base leading-relaxed md:text-lg"
          style={{
            color: 'var(--aura-text-secondary, #a0a8b0)',
            fontFamily: "var(--aura-font-body)",
          }}
        >
          {data.heroSubtitle}
        </p>
        <div className="flex flex-col items-center justify-center gap-4 md:flex-row">
          <button
            type="button"
            onClick={onBookNow}
            className="bronze-glow-events-new w-full px-10 py-4 font-label-caps text-xs uppercase tracking-widest transition-all hover:brightness-110 md:w-auto"
            style={{
              backgroundColor: 'var(--aura-chrome-light)',
              color: '#0c1c30',
            }}
            aria-label={t('events.bookNow')}
          >
            {t('events.bookNow')}
          </button>
          <button
            type="button"
            onClick={onViewSchedule}
            className="btn-chrome-events-new w-full px-10 py-4 font-label-caps text-xs uppercase tracking-widest transition-all md:w-auto"
            aria-label={t('events.viewSchedule')}
          >
            {t('events.viewSchedule')}
          </button>
        </div>
      </div>

      {/* Decorative vertical seam */}
      <div className="absolute bottom-0 left-1/2 h-24 w-px -translate-x-1/2 bg-gradient-to-b from-transparent to-[rgba(68,71,77,0.5)]" />
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
      className="group flex flex-col overflow-hidden rounded-lg transition-all duration-500 hover:-translate-y-2"
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
      <div className="flex flex-col p-6">
        <span className="font-label-caps text-[10px] uppercase tracking-widest text-[var(--aura-chrome-light)]">
          {promo.tag}
        </span>
        <h3
          className="mb-2 mt-2 text-2xl italic text-white"
          style={{ fontFamily: 'var(--aura-font-display-serif, "EB Garamond", Georgia, serif)' }}
        >
          {promo.title}
        </h3>
        <p
          className="mb-6 text-sm leading-relaxed"
          style={{
            color: 'var(--aura-text-secondary, #a0a8b0)',
            fontFamily: "var(--aura-font-body)",
          }}
        >
          {promo.description}
        </p>
        <button
          type="button"
          onClick={() => onCta?.(promo.id)}
          className="mt-auto inline-flex items-center gap-2 text-left font-label-caps text-xs transition-all hover:gap-4"
          style={{ color: 'var(--aura-secondary, var(--aura-primary))' }}
          aria-label={`${t('events.viewDetails')} ${promo.title}`}
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
      className="group flex flex-col border-b py-4 transition-colors md:flex-row md:items-center md:justify-between md:px-4"
      style={{ borderColor: 'rgba(68,71,77,0.2)' }}
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-6">
        {/* Date */}
        <div className="min-w-[60px] text-center">
          <p className="font-label-caps text-[10px]" style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>
            {event.date}
          </p>
          <p
            className="text-2xl italic"
            style={{
              color: 'var(--aura-chrome-light)',
              fontFamily: 'var(--aura-font-display-serif, "EB Garamond", Georgia, serif)',
            }}
          >
            {event.day}
          </p>
        </div>

        {/* Info */}
        <div>
          <h4
            className="text-xl italic text-white"
            style={{ fontFamily: 'var(--aura-font-display-serif, "EB Garamond", Georgia, serif)' }}
          >
            {event.title}
          </h4>
          <p className="font-label-caps text-[11px] tracking-wider" style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>
            {event.time}
          </p>
        </div>
      </div>

      {/* Badge + Action */}
      <div className="mt-4 flex items-center gap-3 md:mt-0">
        <span
          className={clsx(
            'inline-block rounded-full border px-3 py-1 font-label-caps text-[10px] uppercase',
            event.badgeType === 'soldOut' && 'border-[#44474d] text-[#8e9097]',
            event.badgeType === 'available' && 'border-[var(--aura-chrome-light)] text-[var(--aura-chrome-light)]',
            event.badgeType === 'limited' && 'border-[#44474d] text-[var(--aura-text-secondary, #a0a8b0)]',
          )}
        >
          {event.badge}
        </span>

        {event.badgeType === 'soldOut' ? (
          <button
            type="button"
            disabled
            className="flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-full border opacity-50"
            style={{ borderColor: 'var(--aura-outline, #44474d)', color: 'var(--aura-outline, #8e9097)' }}
            aria-label={`${event.title} ${event.badge}`}
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onReserve?.(event.id)}
            className="flex h-9 w-9 items-center justify-center rounded-full border transition-all hover:bg-[var(--aura-primary)] hover:text-[#482a03]"
            style={{ borderColor: 'var(--aura-primary)', color: 'var(--aura-primary)' }}
            aria-label={`${t('events.reserveSpot')} ${event.title}`}
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
}: Readonly<StitchEventsNew1Props>) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');

  const defaultData: EventsPromoPageData = {
    heroTag: t('events.nocturnalSessions'),
    heroTitle: t('events.liveJazzEspresso'),
    heroSubtitle: t('events.heroSubtitle'),
    heroDescription: t('events.heroDescription'),
    heroImageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDQZ_jh2cIn9DWPwzgWJbTKAzTnzDiEHu49EL7QjkzfibflFz0BLLXTxmKU2mYqJniE_iY_j2AACcyrpZLcp6HQo9t3TOR7umfr_OSBpYb8uUT_snx-lxqCD_MbMHWAMGBOLQwL4wI53UetcO_olEg80yPPTmTZ2NW6_mS3hbTxxVt55FEK-LK0vFMS-qS06-dly3VgnzXoHgXQMRrJQnb0ckjnZPRr1K6p7fPW6ZbECMzGmHLwgAdNlASwyN3YhunNi4ANA7KefDY',
    heroImageAlt:
      'A moody, high-contrast photograph of a dimly lit luxury cafe interior at night with warm bronze light catching a chrome espresso machine',
    sectionTitle: t('events.curatedEngagements'),
    sectionDescription: t('events.sectionDescription'),
    promotions: [
      {
        id: 'golden-hour',
        tag: t('events.promotion'),
        title: t('events.goldenHour'),
        description: t('events.goldenHourDesc'),
        ctaLabel: t('events.details'),
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuAm3VcyJQVXnfbrL2pi1TM6GVGawTaENyJSeAN4enTNuUnfB2TmqN-2Wz3XWYNWRtMzFBgPxW1J5SkkbIuzltOxCkvrsEoisR4rqq7bUykFeCMprxT7E7_0ccP5-S56sTMKkvKitGo47vT_KgZEhSX-h_NE9s3cAVSM801J8vHO0_o7EVkZN3FvT7_YJBcR8xVBP5v3Ah-OxgQIVyraUnnIHiJ10sz38lwaojq6yTg16Db_Lw1RtX1kTi3lKTK5-96WtkEaSqMfnjI',
        imageAlt:
          'Close-up shot of a steaming, perfectly layered latte in a thin crystal glass with soft golden light streaming through a warehouse window',
      },
      {
        id: 'bean-craft',
        tag: t('events.workshop'),
        title: t('events.beanCraft'),
        description: t('events.beanCraftDesc'),
        ctaLabel: t('events.reserveSeat'),
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuCEM9xvKBOCwsH1fGEEPUsrO2fXD6WzF3rs_Wel972P79cE5qUXKZ1sz7X7mLSYXF-vVdxF9KfCwGUH4G7SEMJDy9DRxhk2p7zGoWBz8Rj7jCeb3q9PVKIK_Jh1WUXJf4lIysyr6uMU2kgJkNG4J_FNCyZoNBIYhP5nt7dxTA8vgm0YCmijJ1DZNfBmkN9HZNjvMIysgfxwzGc6BD7zJ6CGm-gASrY02URP0KUVbDnU_MvRSbTsMpmbY6kSMj-2AFdYhszlfSMT2U8',
        imageAlt:
          'A macro shot of glossy, dark roasted coffee beans spilling from a vintage metal scoop onto a slate surface',
      },
      {
        id: 'midnight-jazz',
        tag: t('events.livePerformance'),
        title: t('events.midnightJazz'),
        description: t('events.midnightJazzDesc'),
        ctaLabel: t('events.viewLineup'),
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuDdl4TPNPqDmqsr7ahmEfsxFKyyXQSHuugMuxDecD9et__KiRCpFXjtxuwVglaUCo0P0BoqwQ2TOyHFinoND10WlG2_mAH18gMJGoM2J9GQ1BH9ed-0JKy4LMQVFDxo0x7Rk6fh6aNPOYCU31rJvVuxco8oBYXdlfeX60Udp4Aduw5myJW-nLqI3LdTzJNrbmdF8DDHVXamcIclCkjsuwTpyExpk1yyTvGO5kthwU4KQyL7ZWuXDdZp3MZqEPGeckhje0Svf_Ci2Ik',
        imageAlt:
          'A wide-angle interior shot of a luxury industrial cafe at midnight with blue haze and warm amber spots',
      },
    ],
    manifestoTitle: t('events.manifestoTitle'),
    manifestoDescription: t('events.manifestoDescription'),
    manifestoLocation: t('events.manifestoLocation'),
    schedule: [
      {
        id: 's1',
        date: t('events.oct'),
        day: '14',
        title: t('events.coldBrewChemistry'),
        time: '7:00 PM — 9:00 PM',
        badge: t('events.limitedCapacity'),
        badgeType: 'limited',
      },
      {
        id: 's2',
        date: t('events.oct'),
        day: '21',
        title: t('events.blueNoteCollective'),
        time: '10:00 PM — 1:00 AM',
        badge: t('events.soldOut'),
        badgeType: 'soldOut',
      },
      {
        id: 's3',
        date: t('events.oct'),
        day: '28',
        title: t('events.singleOriginSymposium'),
        time: '6:00 PM — 8:00 PM',
        badge: t('events.spotsLeft', { count: 8 }),
        badgeType: 'available',
      },
    ],
    newsletterTitle: t('events.newsletterTitle'),
    newsletterDescription: t('events.newsletterDescription'),
    newsletterFrequency: t('events.newsletterFrequency'),
  };

  const data = externalData ?? defaultData;
  const errorMessage = externalErrMsg ?? t('events.pleaseTryAgain');

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
      <div className="flex min-h-screen items-center justify-center px-6" style={{ backgroundColor: 'var(--aura-bg-page, #081425)' }}>
        <EventsPromoError message={errorMessage} />
      </div>
    );
  }

  /* ─── Empty State ───────────────────────────────────────────── */
  if (!data || data.promotions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6" style={{ backgroundColor: 'var(--aura-bg-page, #081425)' }}>
        <EventsPromoEmpty />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: 'var(--aura-bg-page, #081425)',
        color: 'var(--aura-text-primary, #e8e8e8)',
        fontFamily: "var(--aura-font-body)",
      }}
    >
      {/* ── Hero ────────────────────────────────────────────────── */}
      <HeroSection data={data} onBookNow={onBookNow} onViewSchedule={onViewSchedule} />

      {/* ── Promotions Grid ─────────────────────────────────────── */}
      <section className="py-20" aria-labelledby="promotions-heading">
        <div className="mx-auto max-w-[1280px] px-6">
          <div className="mb-12 flex flex-col items-start justify-between gap-2 md:flex-row md:items-end">
            <div>
              <h2
                id="promotions-heading"
                className="mb-2 text-3xl italic md:text-4xl"
                style={{ fontFamily: 'var(--aura-font-display-serif, "EB Garamond", Georgia, serif)' }}
              >
                {data.sectionTitle}
              </h2>
              <div className="h-1 w-20" style={{ backgroundColor: 'var(--aura-chrome-light)' }} />
            </div>
            <p className="max-w-md text-sm leading-relaxed" style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>
              {data.sectionDescription}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data.promotions.map((promo) => (
              <PromotionCardItem key={promo.id} promo={promo} onCta={onCtaClick} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Event Schedule (Manifesto) ──────────────────────────── */}
      <section
        className="py-20"
        style={{ backgroundColor: 'var(--aura-bg-surface, #071c33)' }}
        aria-labelledby="schedule-heading"
      >
        <div className="mx-auto max-w-[1280px] px-6">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
            {/* Manifesto text */}
            <div className="lg:col-span-4">
              <h2
                id="schedule-heading"
                className="mb-6 text-3xl italic leading-snug md:text-4xl"
                style={{ fontFamily: 'var(--aura-font-display-serif, "EB Garamond", Georgia, serif)' }}
              >
                {data.manifestoTitle}
              </h2>
              <p className="mb-8 text-sm leading-relaxed" style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>
                {data.manifestoDescription}
              </p>
              <div
                className="flex items-center gap-4 border-y py-4"
                style={{ borderColor: 'rgba(68,71,77,0.2)' }}
              >
                <LocationIcon className="h-5 w-5 shrink-0" /* color set by className */ />
                <span className="font-label-caps text-xs tracking-wider" style={{ color: 'var(--aura-text-primary, #e8e8e8)' }}>
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
        <div className="mx-auto max-w-[800px] px-6 text-center">
          <h2
            id="newsletter-heading"
            className="mb-6 text-3xl italic md:text-4xl"
            style={{ fontFamily: 'var(--aura-font-display-serif, "EB Garamond", Georgia, serif)' }}
          >
            {data.newsletterTitle}
          </h2>
          <p className="mx-auto mb-10 max-w-lg text-sm leading-relaxed" style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>
            {data.newsletterDescription}
          </p>

          <form
            onSubmit={handleNewsletterSubmit}
            className="mx-auto flex max-w-xl flex-col gap-2 rounded-full p-1 shadow-xl md:flex-row"
            style={{
              backgroundColor: 'var(--aura-bg-elevated, #182b43)',
              border: '0.5px solid rgba(68,71,77,0.3)',
            }}
            aria-label={t('events.newsletterForm')}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('events.emailPlaceholder')}
              className="w-full flex-1 bg-transparent px-6 py-3 text-sm outline-none md:w-auto"
              style={{
                color: 'var(--aura-text-primary, #e8e8e8)',
                fontFamily: "var(--aura-font-body)",
              }}
              aria-label={t('events.emailPlaceholder')}
            />
            <button
              type="submit"
              className="w-full rounded-full px-10 py-3 font-label-caps text-xs uppercase tracking-wider transition-all duration-300 hover:bg-[var(--aura-chrome-light)] md:w-auto"
              style={{
                backgroundColor: 'var(--aura-text-primary, #e8e8e8)',
                color: 'var(--aura-bg-page, #081425)',
              }}
              aria-label={t('events.subscribe')}
            >
              {t('events.subscribe')}
            </button>
          </form>

          <p
            className="mt-6 font-label-caps text-[10px] uppercase tracking-widest opacity-60"
            style={{ color: 'var(--aura-outline, #8e9097)' }}
          >
            {data.newsletterFrequency}
          </p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer
        className="border-t py-16"
        style={{
          backgroundColor: 'var(--aura-bg-page, #081425)',
          borderColor: 'rgba(68,71,77,0.3)',
        }}
      >
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-8 px-6 md:grid-cols-3">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <span
              className="text-xl italic"
              style={{
                color: 'var(--aura-text-secondary, #a0a8b0)',
                fontFamily: 'var(--aura-font-display-serif, "EB Garamond", Georgia, serif)',
              }}
            >
              {t('events.brandName')}
            </span>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--aura-on-secondary-fixed-variant, #454748)' }}>
              {t('events.footerTagline')}
            </p>
          </div>

          {/* Connect */}
          <div className="flex flex-col gap-3">
            <h5
              className="font-label-caps text-xs uppercase tracking-widest"
              style={{ color: 'var(--aura-secondary, var(--aura-primary))' }}
            >
              {t('events.connect')}
            </h5>
            <div className="flex flex-col gap-2">
              {[
                { key: 'instagram', label: t('events.instagram') },
                { key: 'spotifyPlaylist', label: t('events.spotifyPlaylist') },
                { key: 'contactSocial', label: t('events.contactSocial') },
              ].map((link) => (
                <a
                  key={link.key}
                  href="#"
                  className="font-label-caps text-[11px] transition-colors hover:text-[#d3e3ff]"
                  style={{ color: 'var(--aura-on-secondary-fixed-variant, #454748)' }}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {/* Legal */}
          <div className="flex flex-col gap-3">
            <h5
              className="font-label-caps text-xs uppercase tracking-widest"
              style={{ color: 'var(--aura-secondary, var(--aura-primary))' }}
            >
              {t('events.legal')}
            </h5>
            <div className="flex flex-col gap-2">
              {[
                { key: 'terms', label: t('events.termsOfService') },
                { key: 'privacy', label: t('events.privacyPolicy') },
                { key: 'sustainability', label: t('events.sustainability') },
              ].map((link) => (
                <a
                  key={link.key}
                  href="#"
                  className="font-label-caps text-[11px] transition-colors hover:text-[#d3e3ff]"
                  style={{ color: 'var(--aura-on-secondary-fixed-variant, #454748)' }}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="mx-auto mt-12 flex max-w-[1280px] flex-col items-center gap-4 border-t px-6 pt-8 md:flex-row md:justify-between"
          style={{ borderColor: 'rgba(68,71,77,0.2)' }}
        >
          <p className="font-label-caps text-[10px]" style={{ color: 'var(--aura-on-secondary-fixed-variant, #454748)' }}>
            {t('events.footerCopyright', { year: new Date().getFullYear() })}
          </p>
          <div className="flex items-center gap-4">
            <div className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: 'var(--aura-chrome-light)' }} />
            <span className="font-label-caps text-[10px] uppercase" style={{ color: 'var(--aura-text-primary, #e8e8e8)' }}>
              {t('events.liveStatus')}
            </span>
          </div>
        </div>
      </footer>

      {/* Custom styles */}
      <style>{`
        .bronze-glow-events-new {
          box-shadow: 0 0 20px rgba(212, 165, 116, 0.15);
        }
        .bronze-glow-events-new:hover {
          box-shadow: 0 0 30px rgba(212, 165, 116, 0.3);
        }
        .btn-chrome-events-new {
          background: transparent;
          border: 0.5px solid var(--aura-primary, #c6c6c7);
          color: var(--aura-primary, #c6c6c7);
          position: relative;
          overflow: hidden;
        }
        .btn-chrome-events-new:hover {
          background: rgba(198, 198, 199, 0.1);
          box-shadow: 0 0 15px rgba(198, 198, 199, 0.2);
        }
      `}</style>
    </div>
  );
}
