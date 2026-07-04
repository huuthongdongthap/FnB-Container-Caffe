/**
 * StitchAbout — AURA CAFE Story, Timeline & Spaces (Stitch design)
 *
 * Dark navy glassmorphism about page with hero, bento story grid,
 * vertical timeline, values cards, zones grid, and CTA banner.
 * Source: Stitch AI about/design.html export.
 * Mobile-first responsive.
 */
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  AlertCircle,
  Loader2,
  Building2,
  Coffee,
  Moon,
  Verified,
  Settings2,
  Leaf,
  ScrollText,
  ChevronDown,
  QrCode,
  Smartphone,
  MapPin,
  Star,
} from 'lucide-react';

/* ─── Types ────────────────────────────────────────────────────────── */

export interface Zone {
  id: string;
  name: string;
  role: string;
  imageUrl: string;
  imageAlt: string;
}

export interface TimelinePhase {
  id: string;
  phase: string;
  year: string;
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  isActive?: boolean;
}

export interface StoryCard {
  id: string;
  icon: keyof typeof ICON_MAP;
  title: string;
  description: string;
  imageUrl?: string;
  imageAlt?: string;
  span: string;
}

export interface ValueCard {
  id: string;
  icon: keyof typeof ICON_MAP;
  title: string;
  description: string;
}

export interface AboutPageData {
  heroTitle: string;
  heroSubtitle: string;
  storyTitle: string;
  storyLead: string;
  storyCards: StoryCard[];
  timelinePhases: TimelinePhase[];
  values: ValueCard[];
  zones: Zone[];
}

export type LoadingState = 'idle' | 'loading' | 'error';

export interface StitchAboutProps {
  data?: AboutPageData;
  loadingState?: LoadingState;
  errorMessage?: string;
  onCtaClick?: () => void;
  onZoneClick?: (zoneId: string) => void;
}

/* ─── Icon map ─────────────────────────────────────────────────────── */

const ICON_MAP = {
  architecture: Building2,
  precision_manufacturing: Settings2,
  nights_stay: Moon,
  verified: Verified,
  settings_input_component: Coffee,
  eco: Leaf,
  scroll_text: ScrollText,
  qr_code: QrCode,
  smartphone: Smartphone,
  map_pin: MapPin,
  star: Star,
} as const;

/* ─── Default data is built inside the component using useTranslation ── */

/* ─── Loading Skeleton ─────────────────────────────────────────────── */

function AboutSkeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }}>
      <div className="mx-auto max-w-[1440px] px-[var(--aura-container-padding,24px)]">
        {/* Hero skeleton */}
        <div className="flex min-h-[80vh] flex-col items-center justify-center gap-6">
          <div className="h-4 w-48 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
          <div className="h-16 w-3/4 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
          <div className="h-0.5 w-24 animate-pulse" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
        </div>

        {/* Story skeleton */}
        <div className="mb-8 space-y-4">
          <div className="h-8 w-48 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
          <div className="h-4 w-96 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <div className="col-span-7 h-96 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
          <div className="col-span-5 space-y-6">
            <div className="h-48 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
            <div className="h-48 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
          </div>
        </div>

        {/* Timeline skeleton */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="my-16 flex items-center gap-8">
            <div className="flex-1 space-y-3">
              <div className="h-4 w-24 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
              <div className="h-6 w-48 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
              <div className="h-3 w-72 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
            </div>
            <div className="h-32 w-48 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Error State ──────────────────────────────────────────────────── */

function AboutError({ message }: { message: string }) {
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      style={{ backgroundColor: 'var(--aura-bg-surface, #0d1b2a)' }}
    >
      <AlertCircle className="h-12 w-12" style={{ color: 'var(--aura-error, #ffb4ab)' }} />
      <h3
        className="text-xl font-semibold"
        style={{
          fontFamily: 'var(--aura-font-display, "Cormorant Garamond", Georgia, serif)',
          color: 'var(--aura-text-primary, #e8e8e8)',
        }}
      >
        Failed to Load About Page
      </h3>
      <p style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>{message}</p>
    </div>
  );
}

/* ─── Empty State ──────────────────────────────────────────────────── */

function AboutEmpty() {
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      style={{ backgroundColor: 'var(--aura-bg-surface, #0d1b2a)' }}
    >
      <ScrollText className="h-12 w-12" style={{ color: 'var(--aura-text-disabled, #5a6270)' }} />
      <h3
        className="text-xl font-semibold"
        style={{
          fontFamily: 'var(--aura-font-display, "Cormorant Garamond", Georgia, serif)',
          color: 'var(--aura-text-primary, #e8e8e8)',
        }}
      >
        No Content Available
      </h3>
      <p style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>
        About page content is being prepared.
      </p>
    </div>
  );
}

/* ─── Sub-Components ───────────────────────────────────────────────── */

function HeroSection({
  subtitle,
  title,
}: {
  subtitle: string;
  title: string;
}) {
  const { t } = useTranslation();
  return (
    <section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 z-10"
          style={{ backgroundColor: 'var(--aura-overlay)' }}
        />
        <div
          className="h-full w-full bg-cover bg-center"
          style={{
            backgroundImage:
              'url(https://lh3.googleusercontent.com/aida-public/AB6AXuACV1Udt-Hrc1M1LgOPzS7v8AzKj9LY37FvF84qcsl1xnhN5UpzbjAL7YECy1F2462ZGEk_OP-7A8hik2pOP99Nojnf51y7Mb9IXjGQlTQSBeym9fR_cxzw_ny6yQEcG98L50URyngya9UOMRkc7u4sVMPyLbRdY_AX2IBE_yf7BLinia4L9wIYd3OwmyUkxasutf0d7CdGedJ3TmOVNoAzkuqjCqp37ucfYgkbSivwlE_Pm9uErwenNM_ZOMrcNHe0Ix1egPArFyo)',
          }}
        />
      </div>
      <div className="relative z-20 px-6 text-center">
        <span
          className="mb-6 block animate-pulse font-label-sm uppercase tracking-[0.4em]"
          style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
        >
          {subtitle}
        </span>
        <h1
          className="mx-auto mb-8 max-w-5xl text-5xl font-medium leading-tight text-white md:text-8xl lg:text-9xl"
          style={{ fontFamily: 'var(--aura-font-display-serif, "Cormorant Garamond", Georgia, serif)' }}
        >
          AURA CAFE{' '}
          <span className="italic" style={{ color: 'var(--aura-tertiary, #d4a574)' }}>
            {t('about.address')}
          </span>
        </h1>
        <div
          className="mx-auto h-px w-24 opacity-50"
          style={{ backgroundColor: 'var(--aura-text-secondary, #a0a8b0)' }}
        />
      </div>
      <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-4">
        <span
          className="font-label-sm uppercase tracking-widest opacity-60"
          style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
        >
          Scroll to Explore
        </span>
        <ChevronDown
          className="h-5 w-5 animate-bounce"
          style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
        />
      </div>
    </section>
  );
}

function StorySection({
  title,
  lead,
  cards,
}: {
  title: string;
  lead: string;
  cards: StoryCard[];
}) {
  const getIcon = (key: keyof typeof ICON_MAP) => {
    const Icon = ICON_MAP[key];
    return Icon ? <Icon className="h-8 w-8" /> : null;
  };

  const StoryCardItem = ({
    card,
    index,
  }: {
    card: StoryCard;
    index: number;
  }) => {
    const isFeatured = index === 0;

    return (
      <div
        className={clsx(
          'glass-card-about chrome-border-top group flex flex-col p-8 md:p-12',
          card.span || 'md:col-span-5',
        )}
      >
        <div className="flex items-center gap-4 mb-6">
          <span style={{ color: 'var(--aura-tertiary, #d4a574)' }}>
            {getIcon(card.icon)}
          </span>
          <span
            className="font-bold tracking-tighter"
            style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
          >
            REF: 00{index + 1}
          </span>
        </div>
        <h3
          className="mb-4 text-2xl text-white md:text-3xl"
          style={{ fontFamily: 'var(--aura-font-display, "Libre Caslon Text", Georgia, serif)' }}
        >
          {card.title}
        </h3>
        <p
          className="leading-relaxed"
          style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
        >
          {card.description}
        </p>
        {isFeatured && card.imageUrl && (
          <div className="mt-8 h-48 overflow-hidden rounded-lg border border-white/5 md:h-64">
            <img
              className="h-full w-full object-cover opacity-70 grayscale transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0"
              src={card.imageUrl}
              alt={card.imageAlt ?? card.title}
              loading="lazy"
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="px-[var(--aura-container-padding,24px)] py-24 md:py-32">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-12 md:mb-16">
          <h2
            className="mb-4 text-4xl md:text-5xl"
            style={{
              color: 'var(--aura-text-primary, #e8e8e8)',
              fontFamily: 'var(--aura-font-display, "Libre Caslon Text", Georgia, serif)',
            }}
          >
            {title}
          </h2>
          <p
            className="max-w-2xl font-light leading-relaxed"
            style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
          >
            {lead}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          {cards.map((card, idx) => (
            <StoryCardItem key={card.id} card={card} index={idx} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TimelineSection({ phases }: { phases: TimelinePhase[] }) {
  const { t } = useTranslation();
  return (
    <section
      className="relative py-24 md:py-32"
      style={{ backgroundColor: 'var(--aura-bg-surface, #0d1b2a)' }}
    >
      <div className="mx-auto max-w-[1280px] px-[var(--aura-container-padding,24px)]">
        <div className="mb-16 text-center md:mb-24">
          <h2
            className="mb-4 text-4xl md:text-5xl"
            style={{
              color: 'var(--aura-text-primary, #e8e8e8)',
              fontFamily: 'var(--aura-font-display, "Libre Caslon Text", Georgia, serif)',
            }}
          >
            {t('about.timelineTitle')}
          </h2>
          <p
            className="font-label-sm uppercase tracking-[0.3em]"
            style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
          >
            {t('about.timelineDesc')}
          </p>
        </div>

        <div className="relative mx-auto max-w-4xl">
          {/* Vertical line */}
          <div
            className="timeline-line-about absolute left-1/2 top-0 -translate-x-1/2 bottom-0 w-px"
          />

          {phases.map((phase, idx) => {
            const isLeft = idx % 2 === 0;
            return (
              <div
                key={phase.id}
                className={clsx(
                  'relative mb-20 grid grid-cols-1 items-center gap-8 md:mb-32 md:grid-cols-2 md:gap-16',
                  idx === phases.length - 1 && 'mb-0',
                )}
              >
                {/* Text side */}
                <div className={clsx(!isLeft && 'md:order-2', isLeft ? 'md:text-right' : 'md:text-left')}>
                  <span
                    className="mb-2 block font-label-sm font-bold tracking-widest"
                    style={{ color: 'var(--aura-tertiary, #d4a574)' }}
                  >
                    {phase.phase}: {phase.year}
                  </span>
                  <h4
                    className="mb-4 text-2xl font-semibold text-white"
                    style={{ fontFamily: 'var(--aura-font-display, "Libre Caslon Text", Georgia, serif)' }}
                  >
                    {phase.title}
                  </h4>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
                  >
                    {phase.description}
                  </p>
                </div>

                {/* Image side */}
                <div
                  className={clsx(
                    'relative flex items-center',
                    isLeft ? 'justify-start md:justify-center' : 'justify-end md:justify-center',
                  )}
                >
                  {/* Dot */}
                  <div
                    className={clsx(
                      'absolute z-10 h-4 w-4 rounded-full border-4',
                      isLeft ? '-left-[8.5px] md:left-auto' : '-left-[8.5px] md:right-auto',
                      phase.isActive
                        ? 'border-[var(--aura-tertiary,#d4a574)]'
                        : 'border-[var(--aura-bg-page,#0A1A2E)]',
                    )}
                    style={{
                      backgroundColor: phase.isActive ? 'var(--aura-tertiary, #d4a574)' : 'var(--aura-bg-page, #0A1A2E)',
                      boxShadow: phase.isActive ? '0 0 15px rgba(107, 159, 184, 0.5)' : 'none',
                    }}
                  />
                  <div
                    className={clsx(
                      'glass-card-about w-full p-4 md:p-6',
                      isLeft ? 'ml-8 md:ml-0' : 'ml-8 md:ml-0',
                      phase.isActive && 'border-tertiary/30',
                    )}
                  >
                    <img
                      className={clsx(
                        'h-28 w-full object-cover md:h-32',
                        !phase.isActive && 'opacity-50 grayscale',
                      )}
                      src={phase.imageUrl}
                      alt={phase.imageAlt}
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ValuesSection({ values }: { values: ValueCard[] }) {
  const getIcon = (key: keyof typeof ICON_MAP) => {
    const Icon = ICON_MAP[key];
    return Icon ? <Icon className="h-7 w-7" /> : null;
  };

  return (
    <section className="overflow-hidden px-[var(--aura-container-padding,24px)] py-24 md:py-32">
      <div className="mx-auto max-w-[1280px]">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {values.map((value) => (
            <div
              key={value.id}
              className="glass-card-about group flex flex-col items-center p-8 text-center md:p-12"
            >
              <div
                className="mb-8 flex h-16 w-16 items-center justify-center rounded-full border transition-colors duration-500 group-hover:border-[var(--aura-tertiary,#d4a574)]"
                style={{ borderColor: 'var(--aura-border-muted)' }}
              >
                <div
                  className="transition-colors duration-500 group-hover:text-[var(--aura-tertiary,#d4a574)]"
                  style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
                >
                  {getIcon(value.icon)}
                </div>
              </div>
              <h3
                className="mb-4 uppercase tracking-widest text-white"
                style={{ fontFamily: 'var(--aura-font-display, "Libre Caslon Text", Georgia, serif)' }}
              >
                {value.title}
              </h3>
              <p
                className="text-sm font-light"
                style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
              >
                {value.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ZonesSection({
  zones,
  onZoneClick,
}: {
  zones: Zone[];
  onZoneClick?: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <section
      className="px-[var(--aura-container-padding,24px)] py-24 md:py-32"
      style={{ backgroundColor: 'var(--aura-bg-surface, #0d1b2a)' }}
    >
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-16 flex flex-col items-end justify-between gap-8 md:flex-row md:mb-24">
          <div>
            <h2
              className="mb-4 text-4xl md:text-5xl"
              style={{
                color: 'var(--aura-text-primary, #e8e8e8)',
                fontFamily: 'var(--aura-font-display, "Libre Caslon Text", Georgia, serif)',
              }}
            >
              {t('about.spacesTitle')}
            </h2>
            <p
              className="max-w-md"
              style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
            >
              {t('about.spacesDesc')}
            </p>
          </div>
          <div
            className="hidden h-px w-64 md:block"
            style={{ backgroundColor: 'var(--aura-border-muted)' }}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {zones.map((zone) => (
            <div
              key={zone.id}
              className="group cursor-pointer"
              onClick={() => onZoneClick?.(zone.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onZoneClick?.(zone.id);
              }}
              role="button"
              tabIndex={0}
              aria-label={`Explore ${zone.name}`}
            >
              <div className="glass-card-about relative mb-6 aspect-[4/5] overflow-hidden">
                <img
                  className="h-full w-full object-cover grayscale transition-all duration-500 group-hover:scale-105 group-hover:grayscale-0"
                  src={zone.imageUrl}
                  alt={zone.imageAlt}
                  loading="lazy"
                />
              </div>
              <h4
                className="mb-1 text-lg font-bold tracking-tight text-white"
                style={{ fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)' }}
              >
                {zone.name}
              </h4>
              <p
                className="font-label-sm font-bold uppercase tracking-widest"
                style={{ color: 'var(--aura-tertiary, #d4a574)' }}
              >
                {zone.role}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection({ onCtaClick }: { onCtaClick?: () => void }) {
  const { t } = useTranslation();
  return (
    <section className="px-[var(--aura-container-padding,24px)] py-32 text-center md:py-40">
      <div
        className="glass-card-about relative mx-auto max-w-4xl overflow-hidden p-12 md:p-24"
      >
        {/* Glow orbs */}
        <div
          className="absolute -left-24 -top-24 h-64 w-64 rounded-full blur-[100px]"
          style={{ backgroundColor: 'rgba(107, 159, 184, 0.1)' }}
        />
        <div
          className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full blur-[100px]"
          style={{ backgroundColor: 'rgba(201, 214, 223, 0.1)' }}
        />

        <h2
          className="mb-8 text-4xl text-white md:text-6xl md:leading-tight"
          style={{ fontFamily: 'var(--aura-font-display-serif, "Cormorant Garamond", Georgia, serif)' }}
        >
          {t('about.visitTitle')}
        </h2>
        <p
          className="mx-auto mb-12 max-w-xl font-light leading-relaxed"
          style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
        >
          39 Nguyễn Tất Thành, Sa Đéc, Đồng Tháp. Nơi phong cách container công nghiệp gặp gỡ trải nghiệm cà phê đẳng cấp. / 39 Nguyen Tat Thanh, Sa Dec, Dong Thap. Where industrial container style meets premium coffee experience.
        </p>
        <button
          type="button"
          onClick={onCtaClick}
          className="mx-auto flex items-center gap-3 px-12 py-4 font-label-sm font-bold uppercase tracking-[0.2em] text-[var(--aura-noir-void)] shadow-xl transition-all duration-300 hover:bg-[var(--aura-tertiary,#d4a574)]"
          style={{ backgroundColor: 'var(--aura-tertiary, #d4a574)' }}
        >
          {t('about.exploreNow')}
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </section>
  );
}

/* ─── Main Component ───────────────────────────────────────────────── */

export default function StitchAbout({
  data: externalData,
  loadingState = 'idle',
  errorMessage = 'An unexpected error occurred. Please try again.',
  onCtaClick,
  onZoneClick,
}: Readonly<StitchAboutProps>) {
  const { t } = useTranslation();

  const defaultStoryCards: StoryCard[] = useMemo(
    () => [
      {
        id: 's1',
        icon: 'architecture',
        title: t('about.card1Title'),
        description: t('about.card1Desc'),
        span: 'md:col-span-7',
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuCPfD_Jmk4XFRuVxW23V1fnlA6_1Qu-BNqDWJ2dpYOrn8KE3OveBmrH_EZjrTYFUye1O7Z7Gj2F4NBEqEUsDLx1urd5bqF8rfNfm__g3buZH-uLov62E2-ARnhpxV7zv_x_p4WMOBdCM_TGrZxa3MiOWyeKRL_W2uZj1KDk010YbY7YToBkm21ofLeEpe8RYO1cr4GNwf5WRzOjmdu22tBl8Js-tyfMD_Dri79MVsa3HrV0_T72l6Fzl0P1IKoO4OU5b6MB5KPfGas',
        imageAlt: 'Container architecture at AURA CAFE showing steel and glass design',
      },
      {
        id: 's2',
        icon: 'smartphone',
        title: t('about.card2Title'),
        description: t('about.card2Desc'),
        span: 'md:col-span-5',
      },
      {
        id: 's3',
        icon: 'star',
        title: t('about.card3Title'),
        description: t('about.card3Desc'),
        span: 'md:col-span-5',
      },
    ],
    [t],
  );

  const defaultTimeline: TimelinePhase[] = useMemo(
    () => [
      {
        id: 't1',
        phase: 'PHASE 01',
        year: '2022',
        title: t('about.phase1Title'),
        description: t('about.phase1Desc'),
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuDrhST6weshnMyYXw_5Rn-ORCRUIsoDhbpt4ajVNC7rffHA7Ygn2Lpa6AvG4KEuHwCqsSAEeeXovAV2kvEOJVctf2y3oKYBKE3mSnN9kti5v0Y5bjMx7-cUNU8j6uBXF8SQFINn5nnN1uEv0-2r8_VKIWVen676wqEQwPLD3O1XQftQ-ZC6qbCN7BS2ejgf7UYM5aY4r-Qft1c6Y8dcrXqOClP6hxQ2bXEl0kNiy5wulHktiPGAbZzf1SyVlodxcRjyu3dp56PIh6Y',
        imageAlt: 'Architectural sketches of AURA CAFE container layout',
      },
      {
        id: 't2',
        phase: 'PHASE 02',
        year: '2023',
        title: t('about.phase2Title'),
        description: t('about.phase2Desc'),
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuDzYD6fZHQNR0tpkcoeWVdrTHNO7Y5o9j3mUU_OcfTKuY8u_hRj88Y6WeI0Y9qNb0gIdAw68wpMJm5mrk_c1K-9UC7xUHbRF3vRCjta0kLR-JE5ndeoDbWXyP-4ZiHQepOstt1XmmosLdZpMLCtM9X878CPMNhUhFI6sf241zxJROvJcMbZCYfQAGwjg_J9VVdKNfzURrMsBqsh4kAzEIXf1lx9w96rLKTI9iqa7s-mmymcJcRo4--IXyE1IbVTvr1E_IZUKL2GMso',
        imageAlt: 'Construction progress of AURA CAFE container zones',
      },
      {
        id: 't3',
        phase: 'PHASE 03',
        year: '2024',
        title: t('about.phase3Title'),
        description: t('about.phase3Desc'),
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuBYYcihYurow2nJrdoCiHePwHUYCxmNt1zlg0kMou4a5zFHuyLbwQbY5OqQJvPLeWaXqn_hUV5V6sJGl9OzUToekQCxgn1IDMC0Nsxy0Q9Gu-YJEM1SR8S5J4eWTQicX2ZwTPYqukPe2j6qMM2zMjs7HRbj5jRVAbKJeSiAe-bdslvZUWzABh6QeSjANkXYIi-OoMoLF6-PYx2GmL2oFp4rc89l3xVNJlUmH1ZsIYlcea3ho3bcBNH6oIX6hCInznM0NKWjqiSLwHc',
        imageAlt: t('about.grandOpeningAlt'),
        isActive: true,
      },
      {
        id: 't4',
        phase: 'PHASE 04',
        year: '2025',
        title: t('about.phase4Title'),
        description: t('about.phase4Desc'),
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuCPfD_Jmk4XFRuVxW23V1fnlA6_1Qu-BNqDWJ2dpYOrn8KE3OveBmrH_EZjrTYFUye1O7Z7Gj2F4NBEqEUsDLx1urd5bqF8rfNfm__g3buZH-uLov62E2-ARnhpxV7zv_x_p4WMOBdCM_TGrZxa3MiOWyeKRL_W2uZj1KDk010YbY7YToBkm21ofLeEpe8RYO1cr4GNwf5WRzOjmdu22tBl8Js-tyfMD_Dri79MVsa3HrV0_T72l6Fzl0P1IKoO4OU5b6MB5KPfGas',
        imageAlt: 'QR ordering system at AURA CAFE',
      },
      {
        id: 't5',
        phase: 'PHASE 05',
        year: '2026',
        title: t('about.phase5Title'),
        description: t('about.phase5Desc'),
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuBYYcihYurow2nJrdoCiHePwHUYCxmNt1zlg0kMou4a5zFHuyLbwQbY5OqQJvPLeWaXqn_hUV5V6sJGl9OzUToekQCxgn1IDMC0Nsxy0Q9Gu-YJEM1SR8S5J4eWTQicX2ZwTPYqukPe2j6qMM2zMjs7HRbj5jRVAbKJeSiAe-bdslvZUWzABh6QeSjANkXYIi-OoMoLF6-PYx2GmL2oFp4rc89l3xVNJlUmH1ZsIYlcea3ho3bcBNH6oIX6hCInznM0NKWjqiSLwHc',
        imageAlt: 'AURA CAFE full experience with digital ecosystem',
      },
    ],
    [t],
  );

  const defaultValues: ValueCard[] = useMemo(
    () => [
      {
        id: 'v1',
        icon: 'settings_input_component',
        title: t('about.value1Title'),
        description: t('about.value1Desc'),
      },
      {
        id: 'v2',
        icon: 'map_pin',
        title: t('about.value2Title'),
        description: t('about.value2Desc'),
      },
      {
        id: 'v3',
        icon: 'qr_code',
        title: t('about.value3Title'),
        description: t('about.value3Desc'),
      },
    ],
    [t],
  );

  const defaultZones: Zone[] = useMemo(
    () => [
      {
        id: 'z1',
        name: t('about.zone1Name'),
        role: t('about.zone1Desc'),
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuD0hTVOW-2T_HSEmq53Pb7AEZBFR8ae8eJMY3PL54yKWKRtc9WanD14EXEJmov3uC1btKTebvh8xQr1BkheLr9GnPYtaEBtln5SEecxLVz75JiU8Vf8wo3BAP4bFUXL1UXQ0_6CQvlvck3-HkAQYzX8mY-oOAV22qfADhgusqex-eb2bG3SQn2AJy-XJd76e8LG4atTMmuXQT6JPgVHZgbR7j4Ubp6es3ijUYIvxBCCuJQAtEFlMdccyJJvlYFvABHqRhDKBmx3OMM',
        imageAlt: 'Jade Counter bar at AURA CAFE',
      },
      {
        id: 'z2',
        name: t('about.zone2Name'),
        role: t('about.zone2Desc'),
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuDgfqivZ4J9F9ALO0GTgB_Z0rbCTmUEawwAR3hXr_VRk1h6IR3BcDC7KAMutiNOeRpxmwZlgVDY9V8_iYr-v8hJTfrkRWNkfvJyXcgKUWI8yIFHdLiIvcMo4yHk2tdaNRNoSaAzwEdjqWEjTb-i7e3RHKgN-kPRcwmfCV8kTbD-TrKGj_D2r2ogO-xEtstKWc1OOuYtLFJvj1HHJnyixp68v0NvphBEmertvS1t0AVjjT7VhuWtaE1O4KS0Bq0vOqpCySKxJhslSZQ',
        imageAlt: 'Sky Deck rooftop at AURA CAFE',
      },
      {
        id: 'z3',
        name: t('about.zone3Name'),
        role: t('about.zone3Desc'),
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuAYaFzAQnHsBcweMI-ofjrDs7pX4coYiiouhaKBmGvhfibi7v8L2wPAZeTwkZXBTP4cY_eXb8wzqxzepG385zAsb1cEEzk-McHQF4m6D9Yr8YD1MTNJYKUoXxSuIc3hyozLHE0Ck2TDPqBtEWrtdsJUm8rLq2l231MGOHD9F1_xaK2lOX5tjqYa3Jq7m8_IcWvwCUq8CrzObjAiWVByuImnMtQET04w32DqQM8o7HvfEqzJoOo2RI_SOsfCvgxcx_7QpleGgYWcpvE',
        imageAlt: 'Noir Cabin at AURA CAFE',
      },
      {
        id: 'z4',
        name: t('about.zone4Name'),
        role: t('about.zone4Desc'),
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuAvoHrNnq13Jbj-7p-DBqbVcqXI9vg6xDFaroJ0sK8Zvc0Li1IF7NgFOyRLz2rnimLmKipejw4MNY5SZgXDYR03xCNQGAqpPH7Ttw8pJSmuKZnrCLOYc0_EBUFmoh8r-I-FUbFQMw92vfpXcDpNQEJslu9GtwTeSmGcdfwLpB2211lwtVhxf70G8lbF2zyApMwot3LtykT5pEsDMSo-eqJ3N7Tuddj-_LhtDWgEfK14MidFI2_NBcTDU3c6YoQSoQtResKGGhdknV8',
        imageAlt: 'Aura Lounge silver-themed lounge at AURA CAFE',
      },
      {
        id: 'z5',
        name: t('about.zone5Name'),
        role: t('about.zone5Desc'),
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuCPfD_Jmk4XFRuVxW23V1fnlA6_1Qu-BNqDWJ2dpYOrn8KE3OveBmrH_EZjrTYFUye1O7Z7Gj2F4NBEqEUsDLx1urd5bqF8rfNfm__g3buZH-uLov62E2-ARnhpxV7zv_x_p4WMOBdCM_TGrZxa3MiOWyeKRL_W2uZj1KDk010YbY7YToBkm21ofLeEpe8RYO1cr4GNwf5WRzOjmdu22tBl8Js-tyfMD_Dri79MVsa3HrV0_T72l6Fzl0P1IKoO4OU5b6MB5KPfGas',
        imageAlt: 'VIP Steel Nest premium zone at AURA CAFE',
      },
    ],
    [t],
  );

  const defaultAboutData: AboutPageData = useMemo(
    () => ({
      heroTitle: t('hero.title'),
      heroSubtitle: t('about.heroSubtitle'),
      storyTitle: t('about.storyTitle'),
      storyLead: t('about.storyLead'),
      storyCards: defaultStoryCards,
      timelinePhases: defaultTimeline,
      values: defaultValues,
      zones: defaultZones,
    }),
    [t, defaultStoryCards, defaultTimeline, defaultValues, defaultZones],
  );

  const data = externalData ?? defaultAboutData;

  /* ─── Loading State ─────────────────────────────────────────── */
  if (loadingState === 'loading') {
    return <AboutSkeleton />;
  }

  /* ─── Error State ───────────────────────────────────────────── */
  if (loadingState === 'error') {
    return (
      <div
        className="flex min-h-screen items-center justify-center p-[var(--aura-container-padding,24px)]"
        style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }}
      >
        <AboutError message={errorMessage} />
      </div>
    );
  }

  /* ─── Empty State ───────────────────────────────────────────── */
  if (!data || data.storyCards.length === 0) {
    return (
      <div
        className="flex min-h-screen items-center justify-center p-[var(--aura-container-padding,24px)]"
        style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }}
      >
        <AboutEmpty />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: 'var(--aura-bg-page, #0A1A2E)',
        color: 'var(--aura-text-primary, #e8e8e8)',
      }}
    >
      {/* Hero */}
      <HeroSection subtitle={data.heroSubtitle} title={data.heroTitle} />

      {/* Story */}
      <StorySection
        title={data.storyTitle}
        lead={data.storyLead}
        cards={data.storyCards}
      />

      {/* Timeline */}
      <TimelineSection phases={data.timelinePhases} />

      {/* Values */}
      <ValuesSection values={data.values} />

      {/* Zones */}
      <ZonesSection zones={data.zones} onZoneClick={onZoneClick} />

      {/* CTA */}
      <CtaSection onCtaClick={onCtaClick} />

      {/* Custom styles */}
      <style>{`
        .glass-card-about {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid var(--aura-border-muted, rgba(168, 169, 173, 0.2));
        }
        .chrome-border-top {
          border-top: 1px solid var(--aura-border-muted-strong, rgba(168, 169, 173, 0.4));
        }
        .timeline-line-about {
          background: linear-gradient(to bottom, transparent, var(--aura-chrome-light) 15%, var(--aura-chrome-light) 85%, transparent);
        }
      `}</style>
    </div>
  );
}
