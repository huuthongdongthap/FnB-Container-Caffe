/**
 * StitchEventsNew2 — AURA CAFE Events & Promotions (Stitch design, New v2)
 *
 * Dark navy glassmorphism events layout with Midnight Saxophone Sessions hero,
 * month filter tabs, event cards grid, past archives, and footer.
 * Mobile-first responsive. Named export.
 * Source: Stitch AI aura_cafe_events_promotions_2/code.html export.
 *
 * This is the main composition file. Sub-components, types, hooks, and default
 * data are extracted into dedicated modules to keep each file under 200 LOC.
 */
'use client';

import { useTranslation } from 'react-i18next';

/* ─── Types & Hooks ──────────────────────────────────────────── */

import type { StitchEventsNew2Props, EventsNew2PageData } from './StitchEventsNew2-types';
import { useStitchEvents } from './use-stitch-events';

/* ─── Sub-Components ─────────────────────────────────────────── */

import { EventsNew2Skeleton, EventsNew2Error, EventsNew2Empty } from './StitchEventsNew2-empty';
import { NavBar, HeroSection } from './StitchEventsNew2-header';
import { EventCardItem } from './StitchEventsNew2-card';
import { FilterTabs } from './StitchEventsNew2-timeline';
import { PastArchives, FooterSection } from './StitchEventsNew2-form';

/* ─── Default Data Factory ───────────────────────────────────── */

import { createDefaultEventsData } from './stitch-events-default';

/* ─── Re-export Types ────────────────────────────────────────── */

export type { StitchEventsNew2Props, EventsNew2PageData, EventCard2, ArchiveEvent2, FilterMonth, NavLinkItem, LoadingState } from './StitchEventsNew2-types';

/* ─── Main Component ─────────────────────────────────────────── */

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
  const { activeMonth, handleMonthChange } = useStitchEvents({
    activeMonth: externalActiveMonth,
    onMonthChange,
  });

  const defaultData: EventsNew2PageData = createDefaultEventsData(t);
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
