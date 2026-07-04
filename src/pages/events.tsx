import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUpcomingEvents } from '@/hooks/use-events';
import type { EventItem } from '@/hooks/use-events';
import { StitchEventsNew2 } from '@/components/stitch';
import type { EventsNew2PageData, EventCard2, ArchiveEvent2, FilterMonth } from '@/components/stitch';

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
  /** Navigate to booking page */
  onBookNow?: () => void;
  /** Navigate to schedule view */
  onViewSchedule?: () => void;
  /** Newsletter email submit handler */
  onNewsletterSubmit?: (email: string) => void;
}

/* ─── Helpers ───────────────────────────────── */

const MONTHS_SHORT = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
] as const;

function getDateLabel(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

function getMonthKey(iso: string): string {
  return MONTHS_SHORT[new Date(iso).getMonth()]?.toLowerCase() ?? '';
}

/* ── Adapter: EventItem[] -> EventsNew2PageData ── */

function buildEventsNew2PageData(
  events: EventItem[],
  pastEvents: EventItem[],
  t: (key: string, options?: Record<string, unknown>) => string,
): EventsNew2PageData {
  const featured = events[0];

  const featuredEvents: EventCard2[] = events.map((e) => ({
    id: e.id,
    dateLabel: getDateLabel(e.date),
    title: e.title,
    description: e.description,
    metaLabel: e.time || e.location.toUpperCase(),
    metaIcon: 'schedule',
    imageUrl: e.image ?? '',
    imageAlt: e.title,
  }));

  const pastArchives: ArchiveEvent2[] = pastEvents.map((e) => ({
    id: e.id,
    monthLabel: MONTHS_SHORT[new Date(e.date).getMonth()] ?? '',
    title: e.title,
    imageUrl: e.image ?? '',
    imageAlt: e.title,
  }));

  // Build filter months from unique months in events
  const seenMonths = new Set<string>();
  const filterMonths: FilterMonth[] = [];
  for (const e of events) {
    const key = getMonthKey(e.date);
    if (key && !seenMonths.has(key)) {
      seenMonths.add(key);
      filterMonths.push({ key, label: key.toUpperCase() });
    }
  }

  return {
    heroTag: t('events.nocturnalSessions'),
    heroTitle: featured?.title ?? t('events.defaultTitle'),
    heroDescription: featured?.description ?? t('events.defaultDescription'),
    heroImageUrl: featured?.image ?? '',
    heroImageAlt: featured?.title ?? '',
    navLinks: [
      { key: 'menu', label: t('nav.menu'), href: '#', active: false },
      { key: 'events', label: t('nav.events'), href: '#', active: true },
      { key: 'reservations', label: t('nav.reservations'), href: '#', active: false },
      { key: 'location', label: t('nav.spaces'), href: '#', active: false },
    ],
    filterMonths:
      filterMonths.length > 0
        ? filterMonths
        : [
            { key: 'oct', label: t('eventsNew2.monthOct') },
            { key: 'nov', label: t('eventsNew2.monthNov') },
            { key: 'dec', label: t('eventsNew2.monthDec') },
          ],
    featuredEvents,
    pastArchives,
    footerLinks: [
      { key: 'privacy', label: t('common.privacyPolicy'), href: '#' },
      { key: 'terms', label: t('common.termsOfService'), href: '#' },
      { key: 'contact', label: t('common.contactUs'), href: '#' },
    ],
    copyright: t('eventsNew2.copyright', { year: new Date().getFullYear() }),
  };
}

/* ── Main export ───────────────────────────── */

export function EventsPage({
  events: externalEvents,
  pastEvents: externalPast,
  isLoading: externalLoading,
  isError: externalError,
  onRetry: _onRetry,
  onBookTable,
  onBookNow,
  onViewSchedule: _onViewSchedule,
  onNewsletterSubmit: _onNewsletterSubmit,
}: Readonly<EventsPageProps>) {
  const { t } = useTranslation('events');
  const navigate = useNavigate();
  const hook = useUpcomingEvents();
  const isLoading = externalLoading ?? hook.isLoading;
  const isError = externalError ?? hook.isError;
  const upcoming = externalEvents ?? hook.upcoming;
  const past = externalPast ?? hook.past ?? [];

  // Map loading/error booleans to combined LoadingState enum
  const loadingState =
    isLoading ? 'loading' as const : isError ? 'error' as const : 'idle' as const;

  // Build data object from live API events; undefined triggers defaultData in StitchEventsNew2
  const data =
    !isLoading && !isError && upcoming.length > 0
      ? buildEventsNew2PageData(upcoming, past, t)
      : undefined;

  // Provide sensible defaults for new callbacks not available in legacy interface
  const handleReserveSpot = onBookNow ?? (() => navigate('/table-reservation'));

  return (
    <StitchEventsNew2
      data={data}
      loadingState={loadingState}
      onBookTable={onBookTable}
      onReserveSpot={handleReserveSpot}
    />
  );
}

export default EventsPage;
