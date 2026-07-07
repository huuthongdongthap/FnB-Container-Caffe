/**
 * StitchEventsNew2 — AURA CAFE Events & Promotions (Stitch design, New v2)
 *
 * Dark navy glassmorphism events layout with Midnight Saxophone Sessions hero,
 * month filter tabs, event cards grid, past archives, and footer.
 * Mobile-first responsive. Named export.
 * Source: Stitch AI aura_cafe_events_promotions_2/code.html export.
 */
'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';

/* ─── Types ────────────────────────────────────────────────────────── */

export interface EventCard2 {
  id: string;
  dateLabel: string;
  title: string;
  description: string;
  metaLabel: string;
  metaIcon: string;
  imageUrl: string;
  imageAlt: string;
}

export interface ArchiveEvent2 {
  id: string;
  monthLabel: string;
  title: string;
  imageUrl: string;
  imageAlt: string;
}

export interface FilterMonth {
  key: string;
  label: string;
}

export interface NavLinkItem {
  key: string;
  label: string;
  href: string;
  active?: boolean;
}

export interface EventsNew2PageData {
  heroTag: string;
  heroTitle: string;
  heroDescription: string;
  heroImageUrl: string;
  heroImageAlt: string;
  navLinks: NavLinkItem[];
  filterMonths: FilterMonth[];
  featuredEvents: EventCard2[];
  pastArchives: ArchiveEvent2[];
  footerLinks: Array<{ key: string; label: string; href: string }>;
  copyright: string;
}

export type LoadingState = 'idle' | 'loading' | 'error';

export interface StitchEventsNew2Props {
  data?: EventsNew2PageData;
  loadingState?: LoadingState;
  errorMessage?: string;
  activeMonth?: string;
  onMonthChange?: (month: string) => void;
  onBookTable?: (eventId: string) => void;
  onReserveSpot?: () => void;
  onViewDetails?: () => void;
  onViewArchive?: () => void;
  onNavClick?: (linkKey: string) => void;
  onFilterByType?: () => void;
}

/* ─── SVG Icon Components ─────────────────────────────────────────── */

function CalendarIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function ScheduleIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function RestaurantIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M6 2v12a4 4 0 004 4h4a4 4 0 004-4V2M9 2v6M15 2v6" />
      <path d="M3 22h18" />
    </svg>
  );
}

function TicketIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M2 9a3 3 0 010 6v2a2 2 0 002 2h16a2 2 0 002-2v-2a3 3 0 010-6V7a2 2 0 00-2-2H4a2 2 0 00-2 2v2z" />
      <path d="M13 5v2M13 13v2M13 17v2" />
    </svg>
  );
}

function TuneIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
    </svg>
  );
}

function BookTableIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

/* ─── Loading Skeleton ─────────────────────────────────────────────── */

function EventsNew2Skeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }}>
      {/* Nav skeleton */}
      <div className="fixed top-0 z-50 flex h-20 w-full items-center border-b px-6" style={{ backgroundColor: 'rgba(8,20,37,0.8)', borderColor: 'rgba(68,71,77,0.2)' }}>
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between">
          <div className="h-8 w-32 animate-pulse rounded" style={{ backgroundColor: '#2a3548' }} />
          <div className="hidden h-12 w-28 animate-pulse rounded-lg md:block" style={{ backgroundColor: '#2a3548' }} />
        </div>
      </div>

      {/* Hero skeleton */}
      <div className="mx-auto max-w-[1280px] px-6 pt-24">
        <div className="mb-16 min-h-[500px] rounded-xl p-12" style={{ backgroundColor: '#152031' }}>
          <div className="mx-auto max-w-lg space-y-4">
            <div className="h-4 w-24 animate-pulse rounded" style={{ backgroundColor: '#2a3548' }} />
            <div className="h-12 w-3/4 animate-pulse rounded" style={{ backgroundColor: '#2a3548' }} />
            <div className="h-4 w-full animate-pulse rounded" style={{ backgroundColor: '#2a3548' }} />
            <div className="h-4 w-1/2 animate-pulse rounded" style={{ backgroundColor: '#2a3548' }} />
            <div className="flex gap-4">
              <div className="h-12 w-36 animate-pulse rounded-lg" style={{ backgroundColor: '#2a3548' }} />
              <div className="h-12 w-36 animate-pulse rounded-lg" style={{ backgroundColor: '#2a3548' }} />
            </div>
          </div>
        </div>

        {/* Grid skeleton */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-96 animate-pulse rounded-xl" style={{ backgroundColor: '#152031' }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Error State ──────────────────────────────────────────────────── */

function EventsNew2Error({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      style={{ backgroundColor: 'var(--aura-bg-surface, #071c33)' }}
    >
      <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="#ffb4ab" strokeWidth={1.5} aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      <h3
        className="text-xl font-semibold italic"
        style={{
          fontFamily: "var(--aura-font-display)",
          color: 'var(--aura-text-primary, #e8e8e8)',
        }}
      >
        {t('events.unableToLoad')}
      </h3>
      <p style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>{message}</p>
      <button
        type="button"
        className="mt-2 rounded-lg border px-6 py-2 font-label-caps text-xs uppercase tracking-wider transition-all hover:bg-white/10"
        style={{ borderColor: 'var(--aura-primary, #c6c6c7)', color: 'var(--aura-primary, #c6c6c7)' }}
        aria-label={t('events.retry')}
      >
        {t('events.retry')}
      </button>
    </div>
  );
}

/* ─── Empty State ──────────────────────────────────────────────────── */

function EventsNew2Empty() {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      style={{ backgroundColor: 'var(--aura-bg-surface, #071c33)' }}
    >
      <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="#5a6270" strokeWidth={1.5} aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
      <h3
        className="text-xl font-semibold italic"
        style={{
          fontFamily: "var(--aura-font-display)",
          color: 'var(--aura-text-primary, #e8e8e8)',
        }}
      >
        {t('events.noUpcomingEvents')}
      </h3>
      <p style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>{t('events.checkBackSoon')}</p>
    </div>
  );
}

/* ─── Nav Bar ───────────────────────────────────────────────────────── */

function NavBar({
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

/* ─── Hero Section ──────────────────────────────────────────────────── */

function HeroSection({
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

/* ─── Filter Tabs ──────────────────────────────────────────────────── */

function FilterTabs({
  months,
  activeMonth,
  onMonthChange,
  onFilterByType,
}: {
  months: FilterMonth[];
  activeMonth: string;
  onMonthChange?: (month: string) => void;
  onFilterByType?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section style={{ backgroundColor: 'var(--aura-bg-surface, #071c33)' }}>
      <div className="mx-auto max-w-[1280px] px-5 md:px-12">
        <div
          className="flex items-center justify-between overflow-x-auto border-b pb-4"
          style={{ borderColor: 'rgba(68,71,77,0.2)' }}
        >
          {/* Month buttons */}
          <div className="flex min-w-max gap-12">
            {months.map((month) => (
              <button
                key={month.key}
                type="button"
                onClick={() => onMonthChange?.(month.key)}
                className={clsx(
                  'relative pb-4 font-label-caps text-xs uppercase tracking-wider transition-all',
                  activeMonth === month.key ? '' : 'hover:text-[var(--aura-text-primary, #e8e8e8)]',
                )}
                style={{
                  color: activeMonth === month.key ? '#efbd8a' : 'var(--aura-text-secondary, #a0a8b0)',
                }}
                aria-pressed={activeMonth === month.key}
                aria-label={month.label}
              >
                {month.label}
                {activeMonth === month.key && (
                  <span
                    className="absolute bottom-0 left-0 h-0.5 w-full"
                    style={{ backgroundColor: '#efbd8a' }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Filter by type — desktop only */}
          <button
            type="button"
            onClick={onFilterByType}
            className="hidden items-center gap-1 font-label-caps text-[10px] uppercase tracking-wider md:flex"
            style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
            aria-label={t('events.filterByType')}
          >
            <TuneIcon className="h-4 w-4" />
            {t('events.filterByType')}
          </button>
        </div>
      </div>
    </section>
  );
}

/* ─── Event Card ────────────────────────────────────────────────────── */

function EventCardItem({
  event,
  onBookTable,
}: {
  event: EventCard2;
  onBookTable?: (id: string) => void;
}) {
  const { t } = useTranslation();

  const metaIcon =
    event.metaIcon === 'schedule' ? (
      <ScheduleIcon className="h-[14px] w-[14px]" />
    ) : event.metaIcon === 'restaurant' ? (
      <RestaurantIcon className="h-[14px] w-[14px]" />
    ) : (
      <TicketIcon className="h-[14px] w-[14px]" />
    );

  return (
    <article
      className="group flex flex-col overflow-hidden rounded-xl transition-all duration-500"
      style={{
        backgroundColor: 'rgba(21,32,49,0.4)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '0.5px solid rgba(197,198,205,0.15)',
      }}
      aria-label={event.title}
    >
      {/* Image */}
      <div className="relative h-64 overflow-hidden">
        <div
          className="h-full w-full bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
          style={{ backgroundImage: `url(${event.imageUrl})` }}
          role="img"
          aria-label={event.imageAlt}
        />
        {/* Date badge */}
        <div
          className="absolute left-4 top-4 rounded-full px-3 py-1 font-label-caps text-[10px] uppercase shadow-md"
          style={{
            backgroundColor: '#efbd8a',
            color: '#472a03',
            boxShadow: '0 0 12px rgba(239,189,138,0.2)',
          }}
        >
          {event.dateLabel}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-grow flex-col p-6">
        <h3
          className="mb-2 text-[32px] leading-tight italic text-white"
          style={{ fontFamily: "var(--aura-font-display)" }}
        >
          {event.title}
        </h3>
        <p
          className="mb-6 line-clamp-2 text-base leading-relaxed"
          style={{
            color: 'var(--aura-text-secondary, #a0a8b0)',
            fontFamily: "var(--aura-font-body)",
          }}
        >
          {event.description}
        </p>

        <div className="mt-auto flex items-center justify-between">
          <span
            className="inline-flex items-center gap-1 font-label-caps text-[10px] uppercase tracking-wider"
            style={{ color: '#8e9097' }}
          >
            {metaIcon}
            {event.metaLabel}
          </span>
          <button
            type="button"
            onClick={() => onBookTable?.(event.id)}
            className="rounded px-4 py-2 font-label-caps text-[10px] uppercase tracking-wider transition-all"
            style={{
              background: 'transparent',
              border: '0.5px solid var(--aura-primary, #c6c6c7)',
              color: 'var(--aura-primary, #c6c6c7)',
            }}
            aria-label={`${t('events.bookTable')} ${event.title}`}
          >
            {t('events.bookTable')}
          </button>
        </div>
      </div>
    </article>
  );
}

/* ─── Past Archives ─────────────────────────────────────────────────── */

function PastArchives({
  archives,
  onViewArchive,
}: {
  archives: ArchiveEvent2[];
  onViewArchive?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section
      className="border-t py-20"
      style={{ borderColor: 'rgba(68,71,77,0.1)' }}
      aria-labelledby="past-archives-heading"
    >
      <div className="mx-auto max-w-[1280px] px-5 md:px-12">
        {/* Section heading */}
        <div className="mb-12 flex items-center gap-6">
          <h2
            id="past-archives-heading"
            className="text-[32px] leading-tight italic"
            style={{
              fontFamily: "var(--aura-font-display)",
              color: '#8e9097',
            }}
          >
            {t('events.pastArchives')}
          </h2>
          <div className="h-px flex-grow" style={{ backgroundColor: 'rgba(68,71,77,0.3)' }} />
        </div>

        {/* Archive items */}
        <div
          className="grid grid-cols-1 gap-6 transition-all duration-500 md:grid-cols-3"
          style={{ opacity: 0.6 }}
        >
          {archives.map((archive) => (
            <div
              key={archive.id}
              className="group flex items-center gap-4 rounded-lg p-4 transition-all duration-500 hover:opacity-100"
              style={{
                backgroundColor: 'rgba(21,32,49,0.4)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '0.5px solid rgba(197,198,205,0.15)',
              }}
            >
              <div
                className="h-16 w-16 flex-shrink-0 rounded bg-cover grayscale transition-all duration-500"
                style={{ backgroundImage: `url(${archive.imageUrl})` }}
                role="img"
                aria-label={archive.imageAlt}
              />
              <div>
                <span
                  className="block font-label-caps text-[9px] uppercase tracking-wider"
                  style={{ color: '#8e9097' }}
                >
                  {archive.monthLabel}
                </span>
                <h4
                  className="text-lg italic text-white"
                  style={{ fontFamily: "var(--aura-font-display)" }}
                >
                  {archive.title}
                </h4>
              </div>
            </div>
          ))}
        </div>

        {/* View all */}
        <div className="mt-12 text-center">
          <button
            type="button"
            onClick={onViewArchive}
            className="font-label-caps text-xs uppercase tracking-wider transition-all hover:underline"
            style={{ color: '#efbd8a' }}
            aria-label={t('events.viewFullArchive')}
          >
            {t('events.viewFullArchive')}
          </button>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ────────────────────────────────────────────────────────── */

function FooterSection({
  links,
  copyright,
}: {
  links: Array<{ key: string; label: string; href: string }>;
  copyright: string;
}) {
  const { t } = useTranslation();
  return (
    <footer
      className="w-full border-t py-12 md:py-16"
      style={{
        backgroundColor: 'var(--aura-bg-page, #0A1A2E)',
        borderColor: 'rgba(68,71,77,0.2)',
      }}
      aria-label={t('common.footer')}
    >
      <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-6 px-5 md:flex-row md:px-12">
        {/* Brand */}
        <span
          className="text-[32px] italic tracking-tighter"
          style={{
            fontFamily: 'var(--aura-font-display-serif, "Libre Caslon Text", Georgia, serif)',
            color: 'var(--aura-text-primary, #e8e8e8)',
          }}
        >
          AURA CAFE
        </span>

        {/* Links + copyright */}
        <div className="flex flex-col items-center gap-4 md:items-end">
          <div className="flex gap-6">
            {links.map((link) => (
              <a
                key={link.key}
                href={link.href}
                className="font-label-caps text-xs uppercase tracking-wider transition-colors hover:text-[#efbd8a]"
                style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
                aria-label={link.label}
              >
                {link.label}
              </a>
            ))}
          </div>
          <p
            className="font-label-caps text-[10px] uppercase tracking-wider opacity-60"
            style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
          >
            {copyright}
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ─── Main Component ───────────────────────────────────────────────── */

export function StitchEventsNew2({
  data: externalData,
  loadingState = 'idle',
  errorMessage: externalErrMsg,
  activeMonth: externalActiveMonth,
  onMonthChange,
  onBookTable,
  onReserveSpot,
  onViewDetails,
  onViewArchive,
  onNavClick,
  onFilterByType,
}: Readonly<StitchEventsNew2Props>) {
  const { t } = useTranslation();
  const [internalActiveMonth, setInternalActiveMonth] = useState('oct');

  const activeMonth = externalActiveMonth ?? internalActiveMonth;

  const handleMonthChange = useCallback(
    (month: string) => {
      if (onMonthChange) {
        onMonthChange(month);
      } else {
        setInternalActiveMonth(month);
      }
    },
    [onMonthChange],
  );

  const defaultData: EventsNew2PageData = {
    heroTag: t('events.featured'),
    heroTitle: t('events.defaultTitle'),
    heroDescription: t('events.defaultDescription'),
    heroImageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDlmjmyOnjgZOt4V18ClaqGfhQ_r0HMirAh8VM5O_hIQ1sTpZ6oosG3oDxnhFsFugi2q5EerPpl5lfFhl1NSUJJTiW1Q-XbjjbyMy0AUccp-uZBZO0pRf9purCQ7jAci8IPzR-Wkh2N9pmD-AGIgTt2T3O3d5qel--M4Myq4EIDioeuEHRxz6mOhiyiJzIppQlKa7MoXQzCTZVkZznyFTcalEDKgDLqr0rZnZzzDfu8t1vXTQVpYBenN1RVPicJCT3rFq9QShz7W_U',
    heroImageAlt: t('events.heroAriaLabel'),
    navLinks: [
      { key: 'menu', label: t('nav.menu'), href: '#', active: false },
      { key: 'events', label: t('nav.events'), href: '#', active: true },
      { key: 'reservations', label: t('nav.reservations'), href: '#', active: false },
      { key: 'location', label: t('nav.spaces'), href: '#', active: false },
    ],
    filterMonths: [
      { key: 'oct', label: t('eventsNew2.monthOct') },
      { key: 'nov', label: t('eventsNew2.monthNov') },
      { key: 'dec', label: t('eventsNew2.monthDec') },
      { key: 'jan', label: t('eventsNew2.monthJan') },
    ],
    featuredEvents: [
      {
        id: 'mixology-masterclass',
        dateLabel: 'OCT 14',
        title: t('eventsNew2.mixologyTitle'),
        description: t('eventsNew2.mixologyDesc'),
        metaIcon: 'schedule',
        metaLabel: '19:00 - 21:00',
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuDArV05s4bg-ehkkouTASvhXigAIWBNNSiyeh-2aXFy9_I0YIX9dby9vcSBVh96T_sg_RZU6yFsm9-siWe_MMgo0JUUrMK55O8VKw0lDGdjJ9tYHmG3ehmjpGI74JAEsNmhuIVbkJ7SwECnMGsD27WAd9DOT0mgNzOjAZYh-uvMSWnXdg9Iqh_tH6pNc-9ssvd2n7hQA02-azKO4qRrtKx0KMvcKRGqxs6qRDa9qd2SFD-yV_3y2aiJAZzvuOIiJzSIac6-A4lEwvQ',
        imageAlt: t('eventsNew2.mixologyImageAlt'),
      },
      {
        id: 'industrial-degustation',
        dateLabel: 'OCT 21',
        title: t('eventsNew2.degustationTitle'),
        description: t('eventsNew2.degustationDesc'),
        metaIcon: 'restaurant',
        metaLabel: 'VIP LOUNGE',
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuDyQt6Cr8A_YQeCu9rB_g3rAlg8eYTXwHYBfACraXep5zt6-32Eoz7rnP4w__MYoAFekQVuduS8aBoLFTUecWLwA83wIsD0F1zCbx0DXwhJQD0Qw0ySZSJizG99tABqtCs7rkiV3dB8h-AX0tGSBtMKtpWBVgHqWKSqf48zgbA0IWjUD-0iXfCjEs8AwDRs4mTgFrYyENpfb9izSzC_hnNnP8tqCjYJX_XWfVHO1EjZZYjz7eOcH3VshbxXfhG4IWrqhOugzn5CGHE',
        imageAlt: t('eventsNew2.degustationImageAlt'),
      },
      {
        id: 'digital-art-night',
        dateLabel: 'OCT 28',
        title: t('eventsNew2.digitalArtTitle'),
        description: t('eventsNew2.digitalArtDesc'),
        metaIcon: 'ticket',
        metaLabel: '22:00 - LATE',
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuBtLIALh8AfaCbn2IG6TIK4CG3C78jLtLkUXrI0NNm-afGt0U_jML5W4A_KifeTUgb524UhXEtevHjgxko8a0zt-FXmBAb1nFk-NK6bfGVg7P1o_hmkSNnnPto3YvtVKioTGTDYYjC9W0y1egUQU5sKJBdl8dwuMTNCydjT0jlWgAbUji7U0VCtgkdaXGPbPaupTcLu1GabqjwX7KFQdwDKQbrWakY_gpkWSVFKhe_FwkqI3P2FP3XBa3MC95tP2Iel_Yeg0rMnsjs',
        imageAlt: t('eventsNew2.digitalArtImageAlt'),
      },
    ],
    pastArchives: [
      {
        id: 'vinyl-cognac',
        monthLabel: t('eventsNew2.monthSeptember'),
        title: t('eventsNew2.vinylTitle'),
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuD4aLtsQZNIKe4bt9ny41tokhubrryL9ufhaItSy79jiR2doe4ycWGXZYxE_gyzLOXL7cELCtna355cSaxXlVjxcOaCZqLe4lmwwgnTT0UvHL0VuEfhciwsMfvgp3EXjRjV_1ZhxptyX6ohcapEKgNmQZVUqDK9mwnzAc6dicwRvHtZYVejgq-Hgj1X-e28e5ZbAax6uyAUtkYZS2-ZJ5VJmdBBMFxX3WcgbvUiCC7KTjpDaLHNoccr1YIBCMn-gObDgFJ-lxrUvQE',
        imageAlt: t('eventsNew2.vinylImageAlt'),
      },
      {
        id: 'velvet-cinema',
        monthLabel: t('eventsNew2.monthSeptember'),
        title: t('eventsNew2.velvetTitle'),
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuCRwUZrKfKMQBMJ7_27QmlHYjUbgt-a-4kVShwRVD3QZ8EIsV4xBmNNknl6jraXFMF_ml-p11DJjUFeqU4sNBtexaW8yvKzt33S7YUhRiAi_QBC-zjzbcaD_2-lWKQUK-9d3LxyThr3i6S3oQ0o2FNjgyaz75tpVqJqenIXmVRWE4wKnlY0M7hP-YYU6cHnXEGLScM-ffP9IONGT98newMgqvFn1qZrmqzhJ8VScExyf4g8pf4TRK0qAc6HfFzMMmmgOGQgKLWOC2s',
        imageAlt: t('eventsNew2.velvetImageAlt'),
      },
      {
        id: 'cyber-lounge',
        monthLabel: t('eventsNew2.monthAugust'),
        title: t('eventsNew2.cyberLoungeTitle'),
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuCS9SO54RS39npGil7TyjXO-nRFBFK1aow6IbtiI6lSE5pNXh9eyUXAzrn3AV7FYiRDeAWbcTbKvErPQnSTHCsG0xmeixmh_u8Sr4j362AjWRlFCd2voHtefnbJVcsswsSFgmrjDlG3hNq84NtpyvMkCtVF6Q5bIxzKmeWJSY6s2AInaV5Qahn7eUxEt5j24bZhkneZs_z5L0UPMEHqZO4bullFoQbEghq1DdozmZ_ZkzUkyUIzVOjhyIPVEg9OgxDJdZZ8n_pGmbI',
        imageAlt: t('eventsNew2.cyberLoungeImageAlt'),
      },
    ],
    footerLinks: [
      { key: 'privacy', label: t('common.privacyPolicy'), href: '#' },
      { key: 'terms', label: t('common.termsOfService'), href: '#' },
      { key: 'contact', label: t('common.contactUs'), href: '#' },
    ],
    copyright: t('eventsNew2.copyright', { year: new Date().getFullYear() }),
  };

  const data = externalData ?? defaultData;
  const errorMessage = externalErrMsg ?? '';

  /* ─── Loading State ─────────────────────────────────────────── */
  if (loadingState === 'loading') {
    return <EventsNew2Skeleton />;
  }

  /* ─── Error State ───────────────────────────────────────────── */
  if (loadingState === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center px-6" style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }}>
        <EventsNew2Error message={errorMessage} />
      </div>
    );
  }

  /* ─── Empty State ───────────────────────────────────────────── */
  if (!data || data.featuredEvents.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6" style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }}>
        <EventsNew2Empty />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: 'var(--aura-bg-page, #0A1A2E)',
        color: 'var(--aura-text-primary, #e8e8e8)',
        fontFamily: "var(--aura-font-body)",
      }}
    >
      {/* ── Nav ──────────────────────────────────────────────────── */}
      <NavBar links={data.navLinks} onNavClick={onNavClick} />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <HeroSection
        data={data}
        onReserveSpot={onReserveSpot}
        onViewDetails={onViewDetails}
      />

      {/* ── Filter Tabs ─────────────────────────────────────────── */}
      <FilterTabs
        months={data.filterMonths}
        activeMonth={activeMonth}
        onMonthChange={handleMonthChange}
        onFilterByType={onFilterByType}
      />

      {/* ── Events Grid ─────────────────────────────────────────── */}
      <section className="py-12 md:py-16" aria-labelledby="events-grid-heading">
        <div className="mx-auto max-w-[1280px] px-5 md:px-12">
          <h2 id="events-grid-heading" className="sr-only">
            {t('events.featured')}
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data.featuredEvents.map((event) => (
              <EventCardItem
                key={event.id}
                event={event}
                onBookTable={onBookTable}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Past Archives ───────────────────────────────────────── */}
      <PastArchives archives={data.pastArchives} onViewArchive={onViewArchive} />

      {/* ── Footer ──────────────────────────────────────────────── */}
      <FooterSection links={data.footerLinks} copyright={data.copyright} />

      {/* ── Global styles ────────────────────────────────────────── */}
      <style>{`
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: var(--aura-bg-page, #0A1A2E);
        }
        ::-webkit-scrollbar-thumb {
          background: #2a3548;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #efbd8a;
        }
      `}</style>
    </div>
  );
}
