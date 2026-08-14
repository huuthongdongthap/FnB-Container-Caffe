import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchEventsNew2 } from '../StitchEventsNew2';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => {
      const map: Record<string, string> = {
        'stitch.events': 'Events & Promotions',
        'stitch.midnightSax': 'Midnight Saxophone Sessions',
        'stitch.viewAll': 'View All',
        'stitch.pastEvents': 'Past Events',
        'stitch.noEvents': 'No events found',
        'stitch.loading': 'Loading...',
        'stitch.error': 'Failed to load events',
      };
      return map[key ?? ''] ?? key ?? '';
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
