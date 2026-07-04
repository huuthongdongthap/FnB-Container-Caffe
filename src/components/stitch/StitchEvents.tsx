/**
 * StitchEvents — AURA CAFE Events & Promotions (Stitch design)
 *
 * Dark navy glassmorphism events page with featured hero event,
 * month filter tabs, events card grid, and past archive section.
 * Source: Stitch AI events/design.html export.
 * Mobile-first responsive.
 */
'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import {
  Calendar,
  Clock,
  UtensilsCrossed,
  Ticket,
  ChevronRight,
  SlidersHorizontal,
  Loader2,
  AlertCircle,
  CalendarDays,
} from 'lucide-react';

/* ─── Types ────────────────────────────────────────────────────────── */

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  imageUrl: string;
  imageAlt: string;
  buttonLabel: string;
  month: string;
}

export interface PastEvent {
  id: string;
  title: string;
  month: string;
  imageUrl: string;
  imageAlt: string;
}

export interface FeaturedEvent {
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  buttonLabel: string;
}

export interface EventsPageData {
  featured: FeaturedEvent;
  activeMonth: string;
  months: string[];
  events: CalendarEvent[];
  pastEvents: PastEvent[];
}

export type LoadingState = 'idle' | 'loading' | 'error';

export interface StitchEventsProps {
  data?: EventsPageData;
  loadingState?: LoadingState;
  errorMessage?: string;
  onBookTable?: (eventId: string) => void;
  onViewDetails?: (eventId: string) => void;
  onMonthChange?: (month: string) => void;
  onViewArchive?: () => void;
}


/* ─── Loading Skeleton ─────────────────────────────────────────────── */

function EventsSkeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--aura-bg-page, #081425)' }}>
      <div className="mx-auto max-w-[1280px] px-[var(--aura-container-padding,24px)]">
        {/* Featured hero skeleton */}
        <div className="mb-16 min-h-[500px] rounded-xl p-12" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }}>
          <div className="max-w-lg space-y-4">
            <div className="h-4 w-32 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }} />
            <div className="h-12 w-full animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }} />
            <div className="h-4 w-full animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }} />
            <div className="h-4 w-3/4 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }} />
            <div className="flex gap-4">
              <div className="h-12 w-40 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }} />
              <div className="h-12 w-32 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }} />
            </div>
          </div>
        </div>

        {/* Month tabs skeleton */}
        <div className="mb-8 flex gap-6 border-b pb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-16 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
          ))}
        </div>

        {/* Grid skeleton */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-96 animate-pulse rounded-xl"
              style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Error State ──────────────────────────────────────────────────── */

function EventsError({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      style={{ backgroundColor: 'var(--aura-bg-surface, #0d1b2a)' }}
    >
      <AlertCircle className="h-12 w-12" style={{ color: 'var(--aura-error, #ffb4ab)' }} />
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

function EventsEmpty() {
  const { t } = useTranslation();
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      style={{ backgroundColor: 'var(--aura-bg-surface, #0d1b2a)' }}
    >
      <CalendarDays className="h-12 w-12" style={{ color: 'var(--aura-text-disabled, #5a6270)' }} />
      <h3
        className="text-xl font-semibold"
        style={{
          fontFamily: 'var(--aura-font-display, "Libre Caslon Text", Georgia, serif)',
          color: 'var(--aura-text-primary, #e8e8e8)',
        }}
      >
        {t('events.noUpcomingEvents')}
      </h3>
      <p style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>
        {t('events.checkBackSoon')}
      </p>
    </div>
  );
}

/* ─── Sub-Components ───────────────────────────────────────────────── */

function FeaturedHero({
  featured,
  onBook,
  onDetails,
}: {
  featured: FeaturedEvent;
  onBook?: () => void;
  onDetails?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="relative flex min-h-[500px] items-center justify-center overflow-hidden md:min-h-[870px]">
      {/* Background */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div
          className="h-full w-full scale-110 bg-cover bg-center transition-transform duration-[10s] hover:scale-100"
          style={{ backgroundImage: `url(${featured.imageUrl})` }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, var(--aura-bg-page, #081425) 0%, rgba(8,20,37,0.4) 50%, transparent 100%)',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-[1280px] px-[var(--aura-container-padding,24px)]">
        <div className="glass-panel-events max-w-xl rounded-xl border-l-2 p-8 md:w-7/12 md:p-12">
          <span
            className="mb-4 block font-label-caps text-xs tracking-[0.3em]"
            style={{ color: 'var(--aura-secondary, #efbd8a)' }}
          >
            {t('events.featured')}
          </span>
          <h1
            className="mb-6 text-4xl italic leading-tight text-white md:text-5xl md:leading-tight"
            style={{ fontFamily: 'var(--aura-font-display-serif, "EB Garamond", Georgia, serif)' }}
          >
            {featured.title}
          </h1>
          <p
            className="mb-8 max-w-xl leading-relaxed"
            style={{
              color: 'var(--aura-text-secondary, #a0a8b0)',
              fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
            }}
          >
            {featured.description}
          </p>
          <div className="flex flex-wrap gap-6">
            <button
              type="button"
              onClick={onBook}
              className="bronze-glow-events flex items-center gap-2 rounded-lg px-8 py-4 font-label-caps text-xs font-bold hover:brightness-110"
              style={{
                backgroundColor: 'var(--aura-secondary, #efbd8a)',
                color: 'var(--aura-on-secondary, #472a03)',
              }}
            >
              {featured.buttonLabel}{' '}
              <Calendar className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              onClick={onDetails}
              className="btn-chrome-events rounded-lg px-8 py-4 font-label-caps text-xs font-bold"
            >
              {t('events.viewDetails')}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function EventsGrid({
  events,
  onBookTable,
}: {
  events: CalendarEvent[];
  onBookTable?: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <article
          key={event.id}
          className="glass-panel-events glass-panel-hover-events group flex flex-col overflow-hidden rounded-xl transition-all duration-500"
        >
          {/* Image */}
          <div className="relative h-64 overflow-hidden">
            <div
              className="h-full w-full bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
              style={{ backgroundImage: `url(${event.imageUrl})` }}
            />
            <div
              className="absolute left-4 top-4 rounded-full px-3 py-1 text-[10px] font-bold font-label-caps"
              style={{
                backgroundColor: 'var(--aura-secondary, #efbd8a)',
                color: 'var(--aura-on-secondary, #472a03)',
                boxShadow: '0 0 12px rgba(239, 189, 138, 0.2)',
              }}
            >
              {event.date}
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-grow flex-col p-6">
            <h3
              className="mb-2 text-2xl italic text-white"
              style={{ fontFamily: 'var(--aura-font-display-serif, "EB Garamond", Georgia, serif)' }}
            >
              {event.title}
            </h3>
            <p
              className="mb-6 line-clamp-2"
              style={{
                color: 'var(--aura-text-secondary, #a0a8b0)',
                fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
              }}
            >
              {event.description}
            </p>

            <div className="mt-auto flex items-center justify-between">
              <span
                className="flex items-center gap-1 text-[10px] font-label-caps"
                style={{ color: 'var(--aura-outline, #8e9097)' }}
              >
                {event.time.includes('LOUNGE') || event.time.includes('LATE') ? (
                  <UtensilsCrossed className="h-[14px] w-[14px]" />
                ) : (
                  <Clock className="h-[14px] w-[14px]" />
                )}
                {event.time}
              </span>
              <button
                type="button"
                onClick={() => onBookTable?.(event.id)}
                className="btn-chrome-events rounded px-4 py-2 text-[10px] font-bold font-label-caps"
              >
                {event.buttonLabel}
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function PastArchive({
  events,
  onViewArchive,
}: {
  events: PastEvent[];
  onViewArchive?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="border-t py-20" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
      <div className="mx-auto max-w-[1280px] px-[var(--aura-container-padding,24px)]">
        <div className="mb-8 flex items-center gap-6">
          <h2
            className="text-2xl"
            style={{
              color: 'var(--aura-outline, #8e9097)',
              fontFamily: 'var(--aura-font-display-serif, "EB Garamond", Georgia, serif)',
            }}
          >
            {t('events.pastArchives')}
          </h2>
          <div className="h-px flex-grow" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
        </div>

        <div className="past-archive-events grid grid-cols-1 gap-6 md:grid-cols-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="glass-panel-events flex items-center gap-4 rounded-lg p-4"
            >
              <div
                className="h-16 w-16 shrink-0 rounded bg-cover"
                style={{ backgroundImage: `url(${event.imageUrl})` }}
              />
              <div>
                <span
                  className="block text-[9px] font-bold font-label-caps"
                  style={{ color: 'var(--aura-outline, #8e9097)' }}
                >
                  {event.month}
                </span>
                <h4
                  className="text-lg"
                  style={{
                    color: 'var(--aura-text-primary, #e8e8e8)',
                    fontFamily: 'var(--aura-font-display-serif, "EB Garamond", Georgia, serif)',
                  }}
                >
                  {event.title}
                </h4>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={onViewArchive}
            className="font-label-caps text-xs hover:underline"
            style={{ color: 'var(--aura-secondary, #efbd8a)' }}
          >
            {t('events.viewFullArchive')}
          </button>
        </div>
      </div>
    </section>
  );
}

/* ─── Main Component ───────────────────────────────────────────────── */

export default function StitchEvents({
  data: externalData,
  loadingState = 'idle',
  errorMessage: externalErrMsg,
  onBookTable,
  onViewDetails,
  onMonthChange,
  onViewArchive,
}: Readonly<StitchEventsProps>) {
  const { t } = useTranslation();
  const [activeMonth, setActiveMonth] = useState(externalData?.activeMonth ?? 'OCT');

  const defaultData: EventsPageData = {
    featured: {
      title: 'Midnight Saxophone Sessions',
      description:
        'Experience an evocative evening of smooth jazz and experimental rhythms. Featuring world-renowned soloists in our intimate industrial-chic gallery space. Limited reservations available for the velvet lounge.',
      imageUrl:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDlmjmyOnjgZOt4V18ClaqGfhQ_r0HMirAh8VM5O_hIQ1sTpZ6oosG3oDxnhFsFugi2q5EerPpl5lfFhl1NSUJJTiW1Q-XbjjbyMy0AUccp-uZBZO0pRf9purCQ7jAci8IPzR-Wkh2N9pmD-AGIgTt2T3O3d5qel--M4Myq4EIDioeuEHRxz6mOhiyiJzIppQlKa7MoXQzCTZVkZznyFTcalEDKgDLqr0rZnZzzDfu8t1vXTQVpYBenN1RVPicJCT3rFq9QShz7W_U',
      imageAlt: 'Luxury jazz lounge at night with soft indigo haze and amber light',
      buttonLabel: t('events.reserveSpot'),
    },
    activeMonth: 'OCT',
    months: ['OCT', 'NOV', 'DEC', 'JAN'],
    events: [
      {
        id: 'e1',
        title: 'Aura Mixology Masterclass',
        description:
          'Uncover the secrets behind our signature nocturnal infusions with our lead mixologist.',
        date: 'OCT 14',
        time: '19:00 - 21:00',
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuDArV05s4bg-ehkkouTASvhXigAIWBNNSiyeh-2aXFy9_I0YIX9dby9vcSBVh96T_sg_RZU6yFsm9-siWe_MMgo0JUUrMK55O8VKw0lDGdjJ9tYHmG3ehmjpGI74JAEsNmhuIVbkJ7SwECnMGsD27WAd9DOT0mgNzOjAZYh-uvMSWnXdg9Iqh_tH6pNc-9ssvd2n7hQA02-azKO4qRrtKx0KMvcKRGqxs6qRDa9qd2SFD-yV_3y2aiJAZzvuOIiJzSIac6-A4lEwvQ',
        imageAlt: 'Macro shot of a sophisticated cocktail with vapor rising from dry ice',
        buttonLabel: t('events.bookTable'),
        month: 'OCT',
      },
      {
        id: 'e2',
        title: 'Industrial Degustation',
        description:
          'A curated 7-course culinary journey inspired by raw industrial elements and rare botanicals.',
        date: 'OCT 21',
        time: 'VIP LOUNGE',
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuDyQt6Cr8A_YQeCu9rB_g3rAlg8eYTXwHYBfACraXep5zt6-32Eoz7rnP4w__MYoAFekQVuduS8aBoLFTUecWLwA83wIsD0F1zCbx0DXwhJQD0Qw0ySZSJizG99tABqtCs7rkiV3dB8h-AX0tGSBtMKtpWBVgHqWKSqf48zgbA0IWjUD-0iXfCjEs8AwDRs4mTgFrYyENpfb9izSzC_hnNnP8tqCjYJX_XWfVHO1EjZZYjz7eOcH3VshbxXfhG4IWrqhOugzn5CGHE',
        imageAlt: 'Artistic high-angle shot of long dining table for tasting menu',
        buttonLabel: t('events.bookTable'),
        month: 'OCT',
      },
      {
        id: 'e3',
        title: 'Echoes: Digital Art Night',
        description:
          'A sensory immersion combining generative digital art with experimental electronic soundscapes.',
        date: 'OCT 28',
        time: '22:00 - LATE',
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuBtLIALh8AfaCbn2IG6TIK4CG3C78jLtLkUXrI0NNm-afGt0U_jML5W4A_KifeTUgb524UhXEtevHjgxko8a0zt-FXmBAb1nFk-NK6bfGVg7P1o_hmkSNnnPto3YvtVKioTGTDYYjC9W0y1egUQU5sKJBdl8dwuMTNCydjT0jlWgAbUji7U0VCtgkdaXGPbPaupTcLu1GabqjwX7KFQdwDKQbrWakY_gpkWSVFKhe_FwkqI3P2FP3XBa3MC95tP2Iel_Yeg0rMnsjs',
        imageAlt: 'Low-light scene inside private art gallery with digital art on walls',
        buttonLabel: t('events.bookTable'),
        month: 'OCT',
      },
    ],
    pastEvents: [
      {
        id: 'p1',
        title: 'Vinyl & Cognac',
        month: 'SEPTEMBER',
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuD4aLtsQZNIKe4bt9ny41tokhubrryL9ufhaItSy79jiR2doe4ycWGXZYxE_gyzLOXL7cELCtna355cSaxXlVjxcOaCZqLe4lmwwgnTT0UvHL0VuEfhciwsMfvgp3EXjRjV_1ZhxptyX6ohcapEKgNmQZVUqDK9mwnzAc6dicwRvHtZYVejgq-Hgj1X-e28e5ZbAax6uyAUtkYZS2-ZJ5VJmdBBMFxX3WcgbvUiCC7KTjpDaLHNoccr1YIBCMn-gObDgFJ-lxrUvQE',
        imageAlt: 'Blurred background of a dark vinyl listening room with warm wood textures',
      },
      {
        id: 'p2',
        title: 'Velvet Cinema Night',
        month: 'SEPTEMBER',
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuCRwUZrKfKMQBMJ7_27QmlHYjUbgt-a-4kVShwRVD3QZ8EIsV4xBmNNknl6jraXFMF_ml-p11DJjUFeqU4sNBtexaW8yvKzt33S7YUhRiAi_QBC-zjzbcaD_2-lWKQUK-9d3LxyThr3i6S3oQ0o2FNjgyaz75tpVqJqenIXmVRWE4wKnlY0M7hP-YYU6cHnXEGLScM-ffP9IONGT98newMgqvFn1qZrmqzhJ8VScExyf4g8pf4TRK0qAc6HfFzMMmmgOGQgKLWOC2s',
        imageAlt: 'Dark moody image of velvet curtains in a private theater setting',
      },
      {
        id: 'p3',
        title: 'Cyber-Lounge Launch',
        month: 'AUGUST',
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuCS9SO54RS39npGil7TyjXO-nRFBFK1aow6IbtiI6lSE5pNXh9eyUXAzrn3AV7FYiRDeAWbcTbKvErPQnSTHCsG0xmeixmh_u8Sr4j362AjWRlFCd2voHtefnbJVcsswsSFgmrjDlG3hNq84NtpyvMkCtVF6Q5bIxzKmeWJSY6s2AInaV5Qahn7eUxEt5j24bZhkneZs_z5L0UPMEHqZO4bullFoQbEghq1DdozmZ_ZkzUkyUIzVOjhyIPVEg9OgxDJdZZ8n_pGmbI',
        imageAlt: 'Abstract close-up of dark metallic textures and glowing blue light lines',
      },
    ],
  };

  const data = externalData ?? defaultData;
  const errorMessage = externalErrMsg ?? t('events.pleaseTryAgain');

  const handleMonthChange = useCallback(
    (month: string) => {
      setActiveMonth(month);
      onMonthChange?.(month);
    },
    [onMonthChange],
  );

  const filteredEvents = useCallback(() => {
    if (!data) return [];
    return data.events.filter((e) => e.month === activeMonth);
  }, [data, activeMonth]);

  const visibleEvents = filteredEvents();

  /* ─── Loading State ─────────────────────────────────────────── */
  if (loadingState === 'loading') {
    return <EventsSkeleton />;
  }

  /* ─── Error State ───────────────────────────────────────────── */
  if (loadingState === 'error') {
    return (
      <div
        className="flex min-h-screen items-center justify-center p-[var(--aura-container-padding,24px)]"
        style={{ backgroundColor: 'var(--aura-bg-page, #081425)' }}
      >
        <EventsError message={errorMessage} />
      </div>
    );
  }

  /* ─── Empty State ───────────────────────────────────────────── */
  if (!data || data.events.length === 0) {
    return (
      <div
        className="flex min-h-screen items-center justify-center p-[var(--aura-container-padding,24px)]"
        style={{ backgroundColor: 'var(--aura-bg-page, #081425)' }}
      >
        <EventsEmpty />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: 'var(--aura-bg-page, #081425)',
        color: 'var(--aura-text-primary, #e8e8e8)',
        fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
      }}
    >
      {/* ── Featured Hero ─────────────────────────────────────────── */}
      <FeaturedHero
        featured={data.featured}
        onBook={() => onBookTable?.('featured')}
        onDetails={() => onViewDetails?.('featured')}
      />

      {/* ── Filtering Tabs ────────────────────────────────────────── */}
      <section style={{ backgroundColor: 'var(--aura-bg-surface, #0d1b2a)' }}>
        <div className="mx-auto max-w-[1280px] px-[var(--aura-container-padding,24px)] py-6">
          <div className="flex items-center justify-between overflow-x-auto border-b pb-4" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="flex min-w-max gap-6">
              {data.months.map((month) => (
                <button
                  key={month}
                  type="button"
                  onClick={() => handleMonthChange(month)}
                  className={clsx(
                    'relative pb-4 font-label-caps text-xs font-bold transition-all',
                    activeMonth === month
                      ? ''
                      : 'hover:text-[var(--aura-text-primary, #e8e8e8)]',
                  )}
                  style={{
                    color:
                      activeMonth === month
                        ? 'var(--aura-secondary, #efbd8a)'
                        : 'var(--aura-text-secondary, #a0a8b0)',
                  }}
                >
                  {month}
                  {activeMonth === month && (
                    <span
                      className="absolute bottom-0 left-0 h-0.5 w-full"
                      style={{ backgroundColor: 'var(--aura-secondary, #efbd8a)' }}
                    />
                  )}
                </button>
              ))}
            </div>
            <div
              className="hidden items-center gap-4 text-[10px] font-bold font-label-caps md:flex"
              style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
            >
              <SlidersHorizontal className="h-4 w-4" /> {t('events.filterByType')}
            </div>
          </div>
        </div>
      </section>

      {/* ── Events Grid ───────────────────────────────────────────── */}
      <section className="py-6">
        <div className="mx-auto max-w-[1280px] px-[var(--aura-container-padding,24px)]">
          {visibleEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CalendarDays className="mb-4 h-10 w-10" style={{ color: 'var(--aura-text-disabled, #5a6270)' }} />
              <p style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}>
                {t('events.noEventsInMonth', { month: activeMonth })}
              </p>
            </div>
          ) : (
            <EventsGrid events={visibleEvents} onBookTable={onBookTable} />
          )}
        </div>
      </section>

      {/* ── Past Archives ─────────────────────────────────────────── */}
      <PastArchive events={data.pastEvents} onViewArchive={onViewArchive} />

      {/* Custom styles */}
      <style>{`
        .glass-panel-events {
          background: rgba(21, 32, 49, 0.4);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 0.5px solid rgba(197, 198, 205, 0.15);
        }
        .glass-panel-hover-events:hover {
          border: 0.5px solid rgba(239, 189, 138, 0.4);
          background: rgba(21, 32, 49, 0.6);
        }
        .btn-chrome-events {
          background: transparent;
          border: 0.5px solid var(--chrome, #c5c6cd);
          color: var(--chrome, #c5c6cd);
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        .btn-chrome-events:hover {
          background: rgba(197, 198, 205, 0.1);
          box-shadow: 0 0 15px rgba(197, 198, 205, 0.2);
          transform: translateY(-2px);
        }
        .bronze-glow-events {
          box-shadow: 0 0 12px rgba(239, 189, 138, 0.2);
        }
        .past-archive-events {
          opacity: 0.6;
          filter: grayscale(1);
          transition: all 0.5s;
        }
        .past-archive-events:hover {
          opacity: 1;
          filter: grayscale(0);
        }
      `}</style>
    </div>
  );
}
