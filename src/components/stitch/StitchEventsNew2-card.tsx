/**
 * Event card component for StitchEventsNew2.
 * Extracted from StitchEventsNew2.tsx to keep individual files under 200 LOC.
 */

'use client';

import { useTranslation } from 'react-i18next';
import type { EventCard2 } from './StitchEventsNew2-types';
import { ScheduleIcon, RestaurantIcon, TicketIcon } from './stitch-events-icons';

/* ─── Event Card ─────────────────────────────────────────────── */

export function EventCardItem({
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
