import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchEventsNew2, type EventsNew2PageData } from '../StitchEventsNew2';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => key ?? '',
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

const sampleData: EventsNew2PageData = {
  heroTag: 'Featured',
  heroTitle: 'Events',
  heroDescription: 'Upcoming events',
  heroImageUrl: 'https://example.com/hero.jpg',
  heroImageAlt: 'Hero image',
  navLinks: [
    { key: 'menu', label: 'Menu', href: '/menu' },
    { key: 'events', label: 'Events', href: '/events', active: true },
  ],
  filterMonths: [
    { key: 'oct', label: 'October' },
    { key: 'nov', label: 'November' },
  ],
  featuredEvents: [
    {
      id: 'evt-1',
      dateLabel: 'OCT 14',
      title: 'Mixology Masterclass',
      description: 'Learn cocktail mixing',
      metaLabel: '19:00 - 21:00',
      metaIcon: 'schedule',
      imageUrl: 'https://example.com/evt1.jpg',
      imageAlt: 'Mixology event',
    },
    {
      id: 'evt-2',
      dateLabel: 'NOV 05',
      title: 'Live Jazz Night',
      description: 'Smooth jazz evening',
      metaLabel: '20:00 - 23:00',
      metaIcon: 'schedule',
      imageUrl: 'https://example.com/evt2.jpg',
      imageAlt: 'Jazz night',
    },
  ],
  pastArchives: [
    { id: 'arc-1', monthLabel: 'September', title: 'Wine Tasting', imageUrl: 'https://example.com/arc1.jpg', imageAlt: 'Wine tasting' },
  ],
  footerLinks: [{ key: 'privacy', label: 'Privacy', href: '/privacy' }],
  copyright: '2024 AURA CAFE',
};

describe('StitchEventsNew2', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders featured event cards with titles', () => {
    renderWithProviders(<StitchEventsNew2 data={sampleData} />);
    expect(screen.getByText('Mixology Masterclass')).toBeTruthy();
    expect(screen.getByText('Live Jazz Night')).toBeTruthy();
  });

  it('renders filter month tabs', () => {
    renderWithProviders(<StitchEventsNew2 data={sampleData} />);
    expect(screen.getByText('October')).toBeTruthy();
    expect(screen.getByText('November')).toBeTruthy();
  });

  it('renders past archives section', () => {
    renderWithProviders(<StitchEventsNew2 data={sampleData} />);
    expect(screen.getByText('Wine Tasting')).toBeTruthy();
  });

  it('renders footer with copyright', () => {
    renderWithProviders(<StitchEventsNew2 data={sampleData} />);
    expect(screen.getByText('2024 AURA CAFE')).toBeTruthy();
  });

  it('calls onMonthChange when filter tab clicked', () => {
    const onMonthChange = vi.fn();
    renderWithProviders(<StitchEventsNew2 data={sampleData} onMonthChange={onMonthChange} />);
    fireEvent.click(screen.getByText('November'));
    expect(onMonthChange).toHaveBeenCalledWith('nov');
  });

  it('shows empty state when no events', () => {
    const emptyData = { ...sampleData, featuredEvents: [] };
    renderWithProviders(<StitchEventsNew2 data={emptyData} />);
    expect(screen.queryByText('Mixology Masterclass')).toBeNull();
  });

  it('shows error state', () => {
    renderWithProviders(<StitchEventsNew2 loadingState="error" errorMessage="Network error" />);
    expect(screen.getByText('Network error')).toBeTruthy();
  });
});
