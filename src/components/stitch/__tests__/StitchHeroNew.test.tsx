import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { StitchHeroNew } from '../StitchHeroNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => {
      const map: Record<string, string> = {
        'stitch.hero': 'AURA CAFE',
        'stitch.heroTag': 'Premium Specialty Coffee',
        'stitch.heroTitle': 'AURA CAFE —',
        'stitch.heroSubtitle': 'Container Caffe & Space',
        'stitch.heroDescription': 'An avant-garde sanctuary.',
        'stitch.reservation': 'Book a Table',
        'stitch.viewGallery': 'View Gallery',
      };
      return map[key ?? ''] ?? key ?? '';
    },
  }),
}));

vi.mock('lucide-react', () => ({
  Factory: () => null,
  Coffee: () => null,
  Moon: () => null,
}));

describe('StitchHeroNew', () => {
  it('renders the hero section', () => {
    renderWithProviders(<StitchHeroNew />);
    expect(screen.getByText('AURA CAFE')).toBeTruthy();
  });

  it('renders with custom brand name', () => {
    renderWithProviders(<StitchHeroNew brandName="MY BRAND" />);
    expect(screen.getByText('MY BRAND')).toBeTruthy();
  });

  it('renders with custom background image', () => {
    const { container } = renderWithProviders(
      <StitchHeroNew bgImageUrl="https://example.com/hero.jpg" />,
    );
    expect(container).toBeTruthy();
  });

  it('renders CTA buttons', () => {
    renderWithProviders(<StitchHeroNew />);
    expect(screen.getByText('Book a Table')).toBeTruthy();
    expect(screen.getByText('View Gallery')).toBeTruthy();
  });

  it('renders hero description', () => {
    renderWithProviders(<StitchHeroNew />);
    expect(screen.getByText('An avant-garde sanctuary.')).toBeTruthy();
  });
});
