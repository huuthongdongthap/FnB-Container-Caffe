import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchEventsNew2 } from '../StitchEventsNew2';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'common.contactUs': 'Contact Us',
        'common.footer': 'Footer',
        'common.mainNavigation': 'Main Navigation',
        'common.privacyPolicy': 'Privacy Policy',
        'common.termsOfService': 'Terms Of Service',
        'events.bookTable': 'Book Table',
        'events.checkBackSoon': 'Check Back Soon',
        'events.defaultDescription': 'Default Description',
        'events.defaultTitle': 'Default Title',
        'events.featured': 'Featured',
        'events.filterByType': 'Filter By Type',
        'events.heroAriaLabel': 'Hero Aria Label',
        'events.noUpcomingEvents': 'No Upcoming Events',
        'events.pastArchives': 'Past Archives',
        'events.reserveSpot': 'Reserve Spot',
        'events.retry': 'Retry',
        'events.unableToLoad': 'Unable To Load',
        'events.viewDetails': 'View Details',
        'events.viewFullArchive': 'View Full Archive',
        'eventsNew2.cyberLoungeImageAlt': 'Cyber Lounge Image Alt',
        'eventsNew2.cyberLoungeTitle': 'Cyber Lounge Title',
        'eventsNew2.degustationDesc': 'Degustation Desc',
        'eventsNew2.degustationImageAlt': 'Degustation Image Alt',
        'eventsNew2.degustationTitle': 'Degustation Title',
        'eventsNew2.digitalArtDesc': 'Digital Art Desc',
        'eventsNew2.digitalArtImageAlt': 'Digital Art Image Alt',
        'eventsNew2.digitalArtTitle': 'Digital Art Title',
        'eventsNew2.mixologyDesc': 'Mixology Desc',
        'eventsNew2.mixologyImageAlt': 'Mixology Image Alt',
        'eventsNew2.mixologyTitle': 'Mixology Title',
        'eventsNew2.monthAugust': 'Month August',
        'eventsNew2.monthDec': 'Month Dec',
        'eventsNew2.monthJan': 'Month Jan',
        'eventsNew2.monthNov': 'Month Nov',
        'eventsNew2.monthOct': 'Month Oct',
        'eventsNew2.monthSeptember': 'Month September',
        'eventsNew2.velvetImageAlt': 'Velvet Image Alt',
        'eventsNew2.velvetTitle': 'Velvet Title',
        'eventsNew2.vinylImageAlt': 'Vinyl Image Alt',
        'eventsNew2.vinylTitle': 'Vinyl Title',
        'nav.events': 'Events',
        'nav.menu': 'Menu',
        'nav.reservations': 'Reservations',
        'nav.spaces': 'Spaces',
      }
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
    },
  }),
}));

vi.mock('lucide-react', () => ({
  Calendar: () => null,
  Clock: () => null,
  MapPin: () => null,
  ArrowRight: () => null,
}));

describe('StitchEventsNew2', () => {
  it('renders the events page', () => {
    renderWithProviders(<StitchEventsNew2 />);
    expect(screen.getByText('Events & Promotions')).toBeTruthy();
  });

  it('renders the hero section', () => {
    renderWithProviders(<StitchEventsNew2 />);
    expect(screen.getByText('Midnight Saxophone Sessions')).toBeTruthy();
  });

  it('shows loading state', () => {
    renderWithProviders(<StitchEventsNew2 loadingState="loading" />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('shows error state', () => {
    renderWithProviders(<StitchEventsNew2 loadingState="error" />);
    expect(screen.getByText('Failed to load events')).toBeTruthy();
  });

  it('shows empty state when no events', () => {
    renderWithProviders(<StitchEventsNew2 loadingState="empty" />);
    expect(screen.getByText('No events found')).toBeTruthy();
  });

  it('renders event cards with data', () => {
    renderWithProviders(
      <StitchEventsNew2
        events={[
          { id: '1', dateLabel: 'Aug 15', title: 'Jazz Night', description: 'Live jazz.', imageUrl: '/j.jpg', imageAlt: 'Jazz' },
        ]}
      />,
    );
    expect(screen.getByText('Jazz Night')).toBeTruthy();
  });

  it('renders month filter tabs', () => {
    renderWithProviders(<StitchEventsNew2 />);
    // Should have filter tabs for months
    const allTab = screen.getByText(/all/i);
    expect(allTab).toBeTruthy();
  });
});
