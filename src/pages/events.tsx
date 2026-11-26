import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
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
  if (!iso) return 'UPCOMING';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.toUpperCase();
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

function getMonthKey(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return MONTHS_SHORT[d.getMonth()]?.toLowerCase() ?? '';
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
      { key: 'menu', label: t('nav.menu', { defaultValue: 'Thực đơn' }), href: '/menu', active: false },
      { key: 'events', label: t('nav.events', { defaultValue: 'Sự kiện' }), href: '/events', active: true },
      { key: 'reservations', label: t('nav.reservations', { defaultValue: 'Đặt bàn' }), href: '/table-reservation', active: false },
      { key: 'loyalty', label: t('nav.loyalty', { defaultValue: 'Tích điểm & Ví' }), href: '/loyalty', active: false },
    ],
    filterMonths:
      filterMonths.length > 0
        ? [{ key: 'all', label: 'ALL' }, ...filterMonths]
        : [],
    featuredEvents,
    pastArchives,
    footerLinks: [
      { key: 'privacy', label: t('common.privacyPolicy', { defaultValue: 'Chính sách' }), href: '/privacy' },
      { key: 'terms', label: t('common.termsOfService', { defaultValue: 'Điều khoản' }), href: '/terms' },
      { key: 'contact', label: t('common.contactUs', { defaultValue: 'Liên hệ' }), href: '/contact' },
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
  onRetry: externalRetry,
  onBookTable,
  onBookNow,
  onViewSchedule: _onViewSchedule,
  onNewsletterSubmit: _onNewsletterSubmit,
}: Readonly<EventsPageProps>) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const hook = useUpcomingEvents();
  const isLoading = externalLoading ?? hook.isLoading;
  const isError = externalError ?? hook.isError;
  const upcoming = externalEvents ?? hook.upcoming;
  const past = externalPast ?? hook.past ?? [];
  const onRetry = externalRetry ?? hook.refetch;

  const [selectedTag, setSelectedTag] = useState<string>('all');
  const availableTags = useMemo(() => {
    const tags = Array.from(new Set(upcoming.map((e) => e.tag?.trim()).filter(Boolean))) as string[];
    return ['all', ...tags];
  }, [upcoming]);

  const filteredUpcoming = useMemo(() => {
    if (selectedTag === 'all') return upcoming;
    return upcoming.filter((e) => (e.tag || '').toLowerCase() === selectedTag.toLowerCase());
  }, [upcoming, selectedTag]);

  // Map loading/error booleans to combined LoadingState enum
  const loadingState =
    isLoading ? 'loading' as const : isError ? 'error' as const : 'idle' as const;

  // Always build live data when loaded (never fall back to fabricated OCT 14/21/28 demo events on empty API)
  const data =
    !isLoading && !isError
      ? buildEventsNew2PageData(filteredUpcoming, past, t)
      : undefined;

  // Provide sensible defaults for interactive callbacks
  const handleReserveSpot = onBookNow ?? (() => navigate('/table-reservation'));
  const handleBookEvent = onBookTable ?? ((eventId: string) => navigate(`/table-reservation?event=${encodeURIComponent(eventId)}`));
  const handleNavClick = (href: string) => {
    if (href && href !== '#') {
      navigate(href);
    }
  };
  const handleCycleTypeFilter = () => {
    if (availableTags.length <= 1) return;
    const nextIdx = (availableTags.indexOf(selectedTag) + 1) % availableTags.length;
    setSelectedTag(availableTags[nextIdx] ?? 'all');
  };

  return (
    <>
      <HelmetHead
        title={t('events.seoTitle', { defaultValue: 'Events — AURA CAFE' })}
        description={t('events.seoDescription', { defaultValue: 'Upcoming events and nocturnal sessions at AURA CAFE.' })}
        canonical="/events"
      />
      <StitchEventsNew2
        data={data}
        loadingState={loadingState}
        errorMessage={isError ? t('events.unableToLoad', { defaultValue: 'Không thể tải lịch sự kiện lúc này.' }) : undefined}
        onRetry={onRetry}
        onBookTable={handleBookEvent}
        onReserveSpot={handleReserveSpot}
        onViewDetails={handleReserveSpot}
        onNavClick={handleNavClick}
        onFilterByType={handleCycleTypeFilter}
      />
    </>
  );
}

export default EventsPage;
