import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { HeroSection } from '../stitch-container-new2-hero-section';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'containerNew2.heroAriaLabel': 'Hero Section',
        'containerNew2.reservationAria': 'Book a Table',
        'containerNew2.viewGalleryAria': 'View Gallery',
      };
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
    },
  }),
}));

const HERO_PROPS = {
  heroTag: 'Premium Specialty Coffee',
  heroTitle: 'AURA CAFE —',
  heroSubtitle: 'Container Caffe & Space',
  heroDescription: 'An avant-garde architectural sanctuary.',
  reservationLabel: 'Book a Table',
  viewGalleryLabel: 'View Gallery',
};

describe('HeroSection', () => {
  it('renders hero tag, title, and subtitle', () => {
    renderWithProviders(<HeroSection {...HERO_PROPS} />);
    expect(screen.getByText('Premium Specialty Coffee')).toBeTruthy();
    expect(screen.getByText('AURA CAFE —')).toBeTruthy();
    expect(screen.getByText('Container Caffe & Space')).toBeTruthy();
  });

  it('renders description text', () => {
    renderWithProviders(<HeroSection {...HERO_PROPS} />);
    expect(screen.getByText('An avant-garde architectural sanctuary.')).toBeTruthy();
  });

  it('renders reservation and gallery CTA buttons', () => {
    renderWithProviders(<HeroSection {...HERO_PROPS} />);
    expect(screen.getByText('Book a Table')).toBeTruthy();
    expect(screen.getByText('View Gallery')).toBeTruthy();
  });

  it('calls onReservation when reservation button clicked', () => {
    const onReservation = vi.fn();
    renderWithProviders(<HeroSection {...HERO_PROPS} onReservation={onReservation} />);
    screen.getByText('Book a Table').click();
    expect(onReservation).toHaveBeenCalledOnce();
  });

  it('calls onViewGallery when gallery button clicked', () => {
    const onViewGallery = vi.fn();
    renderWithProviders(<HeroSection {...HERO_PROPS} onViewGallery={onViewGallery} />);
    screen.getByText('View Gallery').click();
    expect(onViewGallery).toHaveBeenCalledOnce();
  });
});
