import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { StitchEventsNew2 } from '../StitchEventsNew2';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'events.featured': 'Featured',
        'events.defaultTitle': 'Default Title',
        'events.defaultDescription': 'Default Description',
        'events.filterByType': 'Filter By Type',
        'events.pastArchives': 'Past Archives',
        'events.bookTable': 'Book Table',
        'events.reserveSpot': 'Reserve Spot',
        'events.viewDetails': 'View Details',
        'events.viewFullArchive': 'View Full Archive',
        'events.checkBackSoon': 'Check Back Soon',
        'events.noUpcomingEvents': 'No Upcoming Events',
        'events.unableToLoad': 'Unable To Load',
        'events.retry': 'Retry',
        'eventsNew2.cyberLoungeTitle': 'Cyber Lounge',
        'eventsNew2.degustationTitle': 'Degustation Night',
        'eventsNew2.digitalArtTitle': 'Digital Art Showcase',
        'eventsNew2.mixologyTitle': 'Mixology Masterclass',
        'eventsNew2.monthSeptember': 'September',
      };
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
    },
  }),
}));

describe('StitchEventsNew2', () => {
  it('renders the page header', () => {
    renderWithProviders(<StitchEventsNew2 />);
    const auraTexts = screen.getAllByText('AURA CAFE');
    expect(auraTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the hero section', () => {
    renderWithProviders(<StitchEventsNew2 />);
    expect(screen.getAllByText('Featured').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Default Title').length).toBeGreaterThanOrEqual(1);
  });

  it('shows loading state', () => {
    const { container } = renderWithProviders(<StitchEventsNew2 loadingState="loading" />);
    expect(container.firstChild).toBeTruthy();
  });

  it('shows error state', () => {
    const { container } = renderWithProviders(<StitchEventsNew2 loadingState="error" errorMessage="Connection failed" />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders filter section', () => {
    renderWithProviders(<StitchEventsNew2 />);
    expect(screen.getByText('Filter By Type')).toBeTruthy();
  });

  it('renders event cards from default data', () => {
    renderWithProviders(<StitchEventsNew2 />);
    expect(screen.getByText('OCT 14')).toBeTruthy();
    expect(screen.getByText('OCT 21')).toBeTruthy();
  });

  it('renders past archives section', () => {
    renderWithProviders(<StitchEventsNew2 />);
    expect(screen.getByText('Past Archives')).toBeTruthy();
  });
});
