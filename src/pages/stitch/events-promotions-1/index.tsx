import { useState, useEffect, useRef } from 'react';
import { StitchShell } from '../StitchBase';
import { EventsNav } from './events-promotions-1-nav';
import { EventsHero } from './events-promotions-1-hero';
import { EventsPromos } from './events-promotions-1-promos';
import { EventsSchedule } from './events-promotions-1-schedule';
import { EventsNewsletter } from './events-promotions-1-newsletter';
import { EventsFooter } from './events-promotions-1-footer';

/* ── Re-export all types and data ────────────────────────────────────── */
export type { NavItem, Promotion, Event } from './events-promotions-1-data';
export {
  NAV_LINKS,
  PROMOTIONS,
  EVENTS,
  FOOTER_CONNECT,
  FOOTER_LEGAL,
  actionIcon,
} from './events-promotions-1-data';

/* ── Component ────────────────────────────────────────────────────────── */

export default function EventsPromotions1() {
  const [hoveredReserve, setHoveredReserve] = useState(false);
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());

  const heroRef = useRef<HTMLElement>(null);
  const promoRef = useRef<HTMLElement>(null);
  const scheduleRef = useRef<HTMLElement>(null);
  const newsletterRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const sections = [
      { id: 'hero', ref: heroRef },
      { id: 'promo', ref: promoRef },
      { id: 'schedule', ref: scheduleRef },
      { id: 'newsletter', ref: newsletterRef },
    ];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections((prev) => new Set(prev).add(entry.target.id));
          }
        });
      },
      { threshold: 0.1 },
    );

    sections.forEach(({ ref }) => {
      if (ref.current) observer.observe(ref.current);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <StitchShell>
      <EventsNav hoveredReserve={hoveredReserve} onHover={setHoveredReserve} />

      <main className="pt-20">
        <EventsHero heroRef={heroRef} isVisible={visibleSections.has('hero')} />
        <EventsPromos promoRef={promoRef} isVisible={visibleSections.has('promo')} />
        <EventsSchedule scheduleRef={scheduleRef} isVisible={visibleSections.has('schedule')} />
        <EventsNewsletter newsletterRef={newsletterRef} isVisible={visibleSections.has('newsletter')} />
      </main>

      <EventsFooter />
    </StitchShell>
  );
}
