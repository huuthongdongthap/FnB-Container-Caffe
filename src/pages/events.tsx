import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUpcomingEvents } from '@/hooks/use-events';
import type { EventItem } from '@/hooks/use-events';
import { StitchEventsNew1 } from '@/components/stitch';
import type { EventsPromoPageData, PromotionCard, ScheduleEvent } from '@/components/stitch';

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

function getMonthLabel(iso: string): string {
  const m = new Date(iso).getMonth();
  return MONTHS_SHORT[m] ?? '';
}

/* ── Adapter: EventItem[] -> EventsPromoPageData ── */

function buildEventsPromoPageData(
  events: EventItem[],
  t: (key: string, options?: Record<string, unknown>) => string,
): EventsPromoPageData {
  const featured = events[0];

  const getScheduleBadge = (
    event: EventItem,
  ): { badge: string; badgeType: 'available' | 'soldOut' | 'limited' } => {
    const full = event.registered >= event.capacity;
    if (full) return { badge: t('events.full'), badgeType: 'soldOut' as const };
    const remaining = event.capacity - event.registered;
    if (remaining <= 3)
      return { badge: t('events.limitedCapacity'), badgeType: 'limited' as const };
    return { badge: t('events.spotsLeft', { count: remaining }), badgeType: 'available' as const };
  };

  const promotions: PromotionCard[] = events.map((e) => ({
    id: e.id,
    tag: (e.tag ?? '').toUpperCase(),
    title: e.title,
    description: e.description,
    ctaLabel: t('events.details'),
    imageUrl: e.image ?? '',
    imageAlt: e.title,
  }));

  const schedule: ScheduleEvent[] = events.map((e) => {
    const badge = getScheduleBadge(e);
    return {
      id: e.id,
      date: getMonthLabel(e.date),
      day: String(new Date(e.date).getDate()),
      title: e.title,
      time: e.time ?? '',
      badge: badge.badge,
      badgeType: badge.badgeType,
      location: e.location,
    };
  });

  return {
    heroTag: t('events.nocturnalSessions'),
    heroTitle: featured?.title ?? t('events.defaultTitle'),
    heroSubtitle: t('events.heroSubtitle'),
    heroDescription: featured?.description ?? t('events.defaultDescription'),
    heroImageUrl: featured?.image ?? '',
    heroImageAlt: featured?.title ?? '',
    sectionTitle: t('events.curatedEngagements'),
    sectionDescription: t('events.sectionDescription'),
    promotions,
    manifestoTitle: t('events.manifestoTitle'),
    manifestoDescription: t('events.manifestoDescription'),
    manifestoLocation: t('events.manifestoLocation'),
    schedule,
    newsletterTitle: t('events.newsletterTitle'),
    newsletterDescription: t('events.newsletterDescription'),
    newsletterFrequency: t('events.newsletterFrequency'),
  };
}

/* ── Main export ───────────────────────────── */

export function EventsPage({
  events: externalEvents,
  pastEvents: _pastEvents,
  isLoading: externalLoading,
  isError: externalError,
  onRetry: _onRetry,
  onBookTable,
  onBookNow,
  onViewSchedule,
  onNewsletterSubmit,
}: Readonly<EventsPageProps>) {
  const { t } = useTranslation('events');
  const navigate = useNavigate();
  const hook = useUpcomingEvents();
  const isLoading = externalLoading ?? hook.isLoading;
  const isError = externalError ?? hook.isError;
  const upcoming = externalEvents ?? hook.upcoming;
  // _pastEvents / _onRetry: intentionally unused — StitchEventsNew1 has no archives section or retry button

  // Map loading/error booleans to combined LoadingState enum
  const loadingState = isLoading ? 'loading' as const : isError ? 'error' as const : 'idle' as const;

  // Build data object from live API events; undefined triggers defaultData in StitchEventsNew1
  const data = !isLoading && !isError && upcoming.length > 0
    ? buildEventsPromoPageData(upcoming, t)
    : undefined;

  // Provide sensible defaults for new callbacks not available in legacy interface
  const handleBookNow = onBookNow ?? (() => navigate('/table-reservation'));

  return (
    <StitchEventsNew1
      data={data}
      loadingState={loadingState}
      onBookNow={handleBookNow}
      onViewSchedule={onViewSchedule}
      onCtaClick={onBookTable}
      onReserveEvent={onBookTable}
      onNewsletterSubmit={onNewsletterSubmit}
    />
  );
}

export default EventsPage;
