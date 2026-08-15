import { useState } from 'react';
import { StitchShell } from '../StitchBase';
import { EVENT_CARDS } from './events-constants';
import { EventsHeader } from './events-header';
import { EventsHero } from './events-hero';
import { EventsCardGrid } from './events-card-grid';
import { EventsSpecialOffer } from './events-special-offer';
import { EventsFooter } from './events-footer';

// Re-exports for backward compatibility
export type { EventCard } from './events-types';
export { EVENT_CARDS, FILTER_TABS } from './events-constants';
export { EventsHeader } from './events-header';
export { EventsHero } from './events-hero';
export { EventsCardGrid } from './events-card-grid';
export { EventsSpecialOffer } from './events-special-offer';
export { EventsFooter } from './events-footer';

export default function EventsPromotions() {
  const [activeFilter, setActiveFilter] = useState('all');

  const filteredCards =
    activeFilter === 'all'
      ? EVENT_CARDS
      : EVENT_CARDS.filter((card) => card.category === activeFilter);

  return (
    <StitchShell>
      <EventsHeader activeFilter={activeFilter} onFilterChange={setActiveFilter} />

      <main className="pt-28 md:pt-24">
        <EventsHero />
        <EventsCardGrid cards={filteredCards} />
        <EventsSpecialOffer />
      </main>

      <EventsFooter />
    </StitchShell>
  );
}
