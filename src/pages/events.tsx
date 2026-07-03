import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  ChevronRight,
  Clock,
  Music,
  Palette,
  SlidersHorizontal,
  Ticket,
  TriangleAlert,
  UtensilsCrossed,
} from 'lucide-react';
import { useUpcomingEvents } from '@/hooks/use-events';
import { Skeleton } from '@/components/ui';
import type { EventItem } from '@/hooks/use-events';

/* ── Types ──────────────────────────────────── */

export interface EventsPageProps {
  /** Optional external events (bypasses hook) */
  events?: EventItem[];
  /** Optional external past events */
  pastEvents?: EventItem[];
  /** Loading state when using external data */
  isLoading?: boolean;
  /** Error state when using external data */
  isError?: boolean;
  /** Retry callback for error state */
  onRetry?: () => void;
  /** Book table callback per event */
  onBookTable?: (eventId: string) => void;
}

/* ─── Helpers ───────────────────────────────── */

const MONTHS_SHORT = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
] as const;

function getMonthLabel(iso: string): string {
  const m = new Date(iso).getMonth();
  return MONTHS_SHORT[m] ?? '';
}

function getDateLabel(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

const TAG_ICONS: Record<string, typeof Clock> = {
  Tasting: UtensilsCrossed,
  Workshop: Music,
  Community: Palette,
  default: Ticket,
};

function getTagIcon(tag: string) {
  return TAG_ICONS[tag] ?? TAG_ICONS.default;
}

/* ── Glass base style (shared via style objects for accuracy) ── */

const glassPanelStyle: React.CSSProperties = {
  background: 'rgba(21, 32, 49, 0.4)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '0.5px solid rgba(197, 198, 205, 0.15)',
};

const chromeBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '0.5px solid var(--aura-primary)',
  color: 'var(--aura-primary)',
};

/* ── Sub-components ─────────────────────────── */

function ChromeButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`px-4 py-2 rounded font-semibold text-[10px] tracking-[0.15em] uppercase transition-all duration-300 ${className}`}
      style={chromeBtnStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(198,198,199,0.1)';
        e.currentTarget.style.boxShadow = '0 0 15px rgba(198,198,199,0.2)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
      {...props}
    />
  );
}

/* ── Loading skeleton ───────────────────────── */

function EventsPageSkeleton() {
  return (
    <div className="bg-[var(--aura-bg-page)]">
      {/* Hero skeleton */}
      <section className="relative min-h-[700px] md:min-h-[870px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[var(--aura-bg-elevated)] animate-pulse" />
        <div className="relative z-10 w-full max-w-[1280px] px-5 md:px-12">
          <div
            className="md:w-7/12 rounded-xl p-6 md:p-12"
            style={{
              background: 'rgba(21, 32, 49, 0.4)',
              backdropFilter: 'blur(16px)',
            }}
          >
            <Skeleton className="mb-6 h-3 w-40 rounded" />
            <Skeleton className="mb-4 h-16 w-full rounded" />
            <Skeleton className="mb-2 h-4 w-3/4 rounded" />
            <Skeleton className="mb-12 h-4 w-1/2 rounded" />
            <div className="flex gap-6">
              <Skeleton className="h-14 w-48 rounded-lg" />
              <Skeleton className="h-14 w-40 rounded-lg" />
            </div>
          </div>
        </div>
      </section>

      {/* Grid skeleton */}
      <section className="py-12 bg-[var(--aura-bg-void)]">
        <div className="max-w-[1280px] mx-auto px-5 md:px-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl overflow-hidden"
                style={{
                  background: 'rgba(21, 32, 49, 0.4)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <Skeleton className="h-64 w-full rounded-none" variant="rectangular" />
                <div className="p-6 space-y-3">
                  <Skeleton className="h-6 w-3/4 rounded" />
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ── Main export ───────────────────────────── */

export function EventsPage({
  events: externalEvents,
  pastEvents: externalPast,
  isLoading: externalLoading,
  isError: externalError,
  onRetry,
  onBookTable,
}: Readonly<EventsPageProps>) {
  const hook = useUpcomingEvents();
  const isLoading = externalLoading ?? hook.isLoading;
  const isError = externalError ?? hook.isError;
  const upcoming = externalEvents ?? hook.upcoming;
  const past = externalPast ?? hook.past;
  const refetch = hook.refetch;

  const [activeMonth, setActiveMonth] = useState<string | null>(null);

  const months = [...new Set(upcoming.map((e) => getMonthLabel(e.date)))];
  const filtered = activeMonth
    ? upcoming.filter((e) => getMonthLabel(e.date) === activeMonth)
    : upcoming;

  /* ── Loading ── */
  if (isLoading) return <EventsPageSkeleton />;

  /* ── Error ── */
  if (isError) {
    return (
      <div className="min-h-screen bg-[var(--aura-bg-page)] flex items-center justify-center px-5">
        <div className="rounded-xl p-12 text-center max-w-lg w-full" style={glassPanelStyle}>
          <TriangleAlert
            className="mx-auto mb-4 h-10 w-10"
            style={{ color: 'var(--aura-tertiary)' }}
          />
          <h2
            className="font-display text-2xl font-bold mb-2"
            style={{ color: 'var(--aura-text-primary)' }}
          >
            Unable to Load Events
          </h2>
          <p
            className="text-sm mb-6"
            style={{ color: 'var(--aura-text-secondary)' }}
          >
            Please try again later.
          </p>
          <button
            type="button"
            onClick={() => (onRetry ?? refetch)()}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-lg font-semibold text-xs tracking-[0.15em] uppercase transition-all duration-300"
            style={chromeBtnStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(198,198,199,0.1)';
              e.currentTarget.style.boxShadow = '0 0 15px rgba(198,198,199,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            RETRY
          </button>
        </div>
      </div>
    );
  }

  const featured = filtered.length > 0 ? filtered[0] : null;

  return (
    <>
      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative min-h-[700px] md:min-h-[870px] flex items-center justify-center overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <div
            className="w-full h-full bg-cover bg-center transition-transform duration-[10s] scale-110 hover:scale-100"
            style={{
              backgroundImage:
                "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDlmjmyOnjgZOt4V18ClaqGfhQ_r0HMirAh8VM5O_hIQ1sTpZ6oosG3oDxnhFsFugi2q5EerPpl5lfFhl1NSUJJTiW1Q-XbjjbyMy0AUccp-uZBZO0pRf9purCQ7jAci8IPzR-Wkh2N9pmD-AGIgTt2T3O3d5qel--M4Myq4EIDioeuEHRxz6mOhiyiJzIppQlKa7MoXQzCTZVkZznyFTcalEDKgDLqr0rZnZzzDfu8t1vXTQVpYBenN1RVPicJCT3rFq9QShz7W_U')",
            }}
            role="img"
            aria-label="Cinematic jazz lounge at night"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--aura-bg-page)] via-[var(--aura-bg-page)]/40 to-transparent" />
        </div>

        {/* Hero content */}
        <div className="relative z-10 w-full max-w-[1280px] px-5 md:px-12">
          <div
            className="md:w-7/12 rounded-xl p-6 md:p-12"
            style={{
              ...glassPanelStyle,
              borderLeft: '2px solid var(--aura-tertiary)',
            }}
          >
            <span
              className="block mb-6 text-xs font-semibold tracking-[0.3em] uppercase"
              style={{ color: 'var(--aura-tertiary)' }}
            >
              FEATURED EVENT
            </span>
            <h1 className="font-display text-[56px] md:text-[72px] leading-tight italic mb-6 text-white">
              {featured?.title ?? 'Midnight Saxophone Sessions'}
            </h1>
            <p
              className="text-lg leading-relaxed mb-12 max-w-xl"
              style={{ color: 'var(--aura-text-secondary)' }}
            >
              {featured?.description ??
                'Experience an evocative evening of smooth jazz and experimental rhythms. Featuring world-renowned soloists in our intimate industrial-chic gallery space.'}
            </p>
            <div className="flex flex-wrap gap-6">
              <Link
                to="/table-reservation"
                className="inline-flex items-center gap-2 px-12 py-4 rounded-lg font-semibold text-xs tracking-[0.15em] uppercase transition-all hover:brightness-110"
                style={{
                  background: 'var(--aura-tertiary)',
                  color: 'var(--aura-on-tertiary)',
                  boxShadow: '0 0 12px rgba(212,165,116,0.2)',
                }}
              >
                RESERVE A SPOT
                <Calendar className="h-[18px] w-[18px]" />
              </Link>
              <button
                type="button"
                className="px-12 py-4 rounded-lg font-semibold text-xs tracking-[0.15em] uppercase transition-all duration-300 hover:-translate-y-0.5"
                style={chromeBtnStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(198,198,199,0.1)';
                  e.currentTarget.style.boxShadow = '0 0 15px rgba(198,198,199,0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                VIEW DETAILS
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ MONTH FILTER ═══════════════ */}
      <section className="py-12" style={{ background: 'var(--aura-bg-void)' }}>
        <div className="max-w-[1280px] mx-auto px-5 md:px-12">
          <div
            className="flex items-center justify-between border-b pb-4 overflow-x-auto"
            style={{ borderColor: 'rgba(42, 53, 72, 0.2)' }}
          >
            <div className="flex space-x-12 min-w-max">
              <button
                type="button"
                onClick={() => setActiveMonth(null)}
                className="font-semibold text-xs tracking-[0.15em] uppercase relative pb-4 transition-all"
                style={{
                  color:
                    activeMonth === null
                      ? 'var(--aura-tertiary)'
                      : 'var(--aura-text-secondary)',
                }}
              >
                ALL
                {activeMonth === null && (
                  <span
                    className="absolute bottom-0 left-0 w-full h-0.5"
                    style={{ background: 'var(--aura-tertiary)' }}
                  />
                )}
              </button>
              {months.map((month) => (
                <button
                  key={month}
                  type="button"
                  onClick={() => setActiveMonth(month)}
                  className="font-semibold text-xs tracking-[0.15em] uppercase relative pb-4 transition-all"
                  style={{
                    color:
                      activeMonth === month
                        ? 'var(--aura-tertiary)'
                        : 'var(--aura-text-secondary)',
                  }}
                >
                  {month}
                  {activeMonth === month && (
                    <span
                      className="absolute bottom-0 left-0 w-full h-0.5"
                      style={{ background: 'var(--aura-tertiary)' }}
                    />
                  )}
                </button>
              ))}
            </div>
            <div
              className="hidden md:flex items-center gap-4 text-[10px] font-semibold tracking-[0.15em] uppercase"
              style={{ color: 'var(--aura-text-secondary)' }}
            >
              <SlidersHorizontal className="h-4 w-4" />
              FILTER BY TYPE
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ EVENTS GRID ═══════════════ */}
      <section className="py-12" style={{ background: 'var(--aura-bg-void)' }}>
        <div className="max-w-[1280px] mx-auto px-5 md:px-12">
          {filtered.length === 0 ? (
            /* Empty state */
            <div className="rounded-xl p-16 text-center" style={glassPanelStyle}>
              <Calendar className="mx-auto mb-4 h-12 w-12" style={{ color: 'var(--aura-tertiary)' }} />
              <h3
                className="font-display text-2xl font-bold mb-2"
                style={{ color: 'var(--aura-text-primary)' }}
              >
                No Events This Month
              </h3>
              <p className="text-sm" style={{ color: 'var(--aura-text-secondary)' }}>
                {activeMonth
                  ? `There are no events scheduled for ${activeMonth}. Check back soon!`
                  : 'No upcoming events at the moment. Stay tuned!'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((event) => {
                const IconComp = getTagIcon(event.tag);
                const TagIcon = IconComp ?? (() => null);
                const isFull = event.registered >= event.capacity;

                return (
                  <div
                    key={event.id}
                    className="group rounded-xl overflow-hidden flex flex-col transition-all duration-500"
                    style={{
                      ...glassPanelStyle,
                    }}
                    onMouseEnter={(e) => {
                      const card = e.currentTarget;
                      card.style.border = '0.5px solid rgba(212,165,116,0.4)';
                      card.style.background = 'rgba(21, 32, 49, 0.6)';
                    }}
                    onMouseLeave={(e) => {
                      const card = e.currentTarget;
                      card.style.border = '0.5px solid rgba(197, 198, 205, 0.15)';
                      card.style.background = 'rgba(21, 32, 49, 0.4)';
                    }}
                  >
                    {/* Card image */}
                    <div className="relative h-64 overflow-hidden">
                      <div
                        className="w-full h-full bg-cover bg-center group-hover:scale-110 transition-transform duration-700"
                        style={{
                          backgroundImage: event.image
                            ? `url(${event.image})`
                            : "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDArV05s4bg-ehkkouTASvhXigAIWBNNSiyeh-2aXFy9_I0YIX9dby9vcSBVh96T_sg_RZU6yFsm9-siWe_MMgo0JUUrMK55O8VKw0lDGdjJ9tYHmG3ehmjpGI74JAEsNmhuIVbkJ7SwECnMGsD27WAd9DOT0mgNzOjAZYh-uvMSWnXdg9Iqh_tH6pNc-9ssvd2n7hQA02-azKO4qRrtKx0KMvcKRGqxs6qRDa9qd2SFD-yV_3y2aiJAZzvuOIiJzSIac6-A4lEwvQ')",
                        }}
                        role="img"
                        aria-label={event.title}
                      />
                      <div
                        className="absolute top-4 left-4 px-3 py-1 rounded-full font-semibold text-[10px] tracking-[0.1em] uppercase"
                        style={{
                          background: 'var(--aura-tertiary)',
                          color: 'var(--aura-on-tertiary)',
                          boxShadow: '0 0 12px rgba(212,165,116,0.2)',
                        }}
                      >
                        {getDateLabel(event.date)}
                      </div>
                      {isFull && (
                        <div className="absolute top-4 right-4 px-2 py-1 rounded-full text-[10px] font-bold tracking-[0.1em] uppercase bg-[rgba(147,0,10,0.85)] text-[#ffdad6]">
                          FULL
                        </div>
                      )}
                    </div>

                    {/* Card body */}
                    <div className="p-6 flex-grow flex flex-col">
                      <h3 className="font-display text-2xl mb-2 italic text-white">
                        {event.title}
                      </h3>
                      <p
                        className="text-sm leading-relaxed mb-6 line-clamp-2"
                        style={{ color: 'var(--aura-text-secondary)' }}
                      >
                        {event.description}
                      </p>

                      <div className="mt-auto flex items-center justify-between">
                        <span
                          className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.1em] uppercase"
                          style={{ color: 'var(--aura-outline)' }}
                        >
                          <TagIcon className="h-3.5 w-3.5" />
                          {event.tag.toUpperCase()}
                        </span>
                        <ChromeButton
                          onClick={() => onBookTable?.(event.id)}
                          disabled={isFull}
                        >
                          {isFull ? 'FULL' : 'BOOK TABLE'}
                        </ChromeButton>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════ PAST ARCHIVES ═══════════════ */}
      <section
        className="py-20"
        style={{
          borderTop: '0.5px solid rgba(42, 53, 72, 0.1)',
          background: 'var(--aura-bg-page)',
        }}
      >
        <div className="max-w-[1280px] mx-auto px-5 md:px-12">
          <div className="flex items-center gap-6 mb-12">
            <h2
              className="font-display text-2xl"
              style={{ color: 'var(--aura-outline)' }}
            >
              Past Archives
            </h2>
            <div
              className="h-px flex-grow"
              style={{ background: 'rgba(42, 53, 72, 0.3)' }}
            />
          </div>

          {past.length === 0 ? (
            <p
              className="text-sm text-center py-8"
              style={{ color: 'var(--aura-text-secondary)' }}
            >
              No past events to display.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 transition-all duration-500 opacity-60 grayscale hover:grayscale-0 hover:opacity-100">
              {past.slice(0, 3).map((event) => (
                <div
                  key={event.id}
                  className="flex gap-4 items-center p-4 rounded-lg"
                  style={glassPanelStyle}
                >
                  <div
                    className="w-16 h-16 rounded flex-shrink-0 bg-cover bg-center"
                    style={{
                      backgroundImage: event.image
                        ? `url(${event.image})`
                        : "url('https://lh3.googleusercontent.com/aida-public/AB6AXuD4aLtsQZNIKe4bt9ny41tokhubrryL9ufhaItSy79jiR2doe4ycWGXZYxE_gyzLOXL7cELCtna355cSaxXlVjxcOaCZqLe4lmwwgnTT0UvHL0VuEfhciwsMfvgp3EXjRjV_1ZhxptyX6ohcapEKgNmQZVUqDK9mwnzAc6dicwRvHtZYVejgq-Hgj1X-e28e5ZbAax6uyAUtkYZS2-ZJ5VJmdBBMFxX3WcgbvUiCC7KTjpDaLHNoccr1YIBCMn-gObDgFJ-lxrUvQE')",
                    }}
                    role="img"
                    aria-label={event.title}
                  />
                  <div>
                    <span
                      className="block font-semibold text-[9px] tracking-[0.15em] uppercase mb-0.5"
                      style={{ color: 'var(--aura-outline)' }}
                    >
                      {getMonthLabel(event.date)}
                    </span>
                    <h4 className="font-display text-lg text-white">
                      {event.title}
                    </h4>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-12 text-center">
            <button
              type="button"
              className="text-xs font-semibold tracking-[0.15em] uppercase transition-all hover:underline inline-flex items-center gap-1"
              style={{ color: 'var(--aura-tertiary)' }}
            >
              VIEW FULL ARCHIVE
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

export default EventsPage;
