import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { StitchHeroNew } from '../StitchHeroNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'footer.allRights': 'All rights reserved.',
        'footer.contact': 'Contact',
        'footer.instagram': 'Instagram',
        'footer.linkedin': 'LinkedIn',
        'footer.privacy': 'Privacy',
        'hero.bookNow': 'Book Now',
        'hero.bookTable': 'Book Your Table',
        'hero.est': 'Est. 2024 • Industrial Luxury',
        'hero.exploreMenu': 'Explore Menu',
        'hero.nocturnal': 'Nocturnal',
        'hero.pour': ' Pour',
        'hero.theArt': 'The Art of the ',
        'home.architecturalConcept': 'Architectural Concept',
        'home.artisanRoasts': 'Artisan Roasts',
        'home.experience': 'Experience',
        'home.findClarity': 'Find clarity in the shadows.',
        'home.industrialRoots': 'Industrial Roots',
        'home.loungeAtmosphere': 'Lounge Atmosphere',
        'home.nightCanvas': 'The Night is Your Canvas',
        'home.signature': 'Signature',
        'home.statusOpen': 'Currently Open',
        'home.theCraft': 'The Craft',
        'nav.about': 'About',
        'nav.gallery': 'Gallery',
        'nav.menu': 'Menu',
        'nav.reservations': 'Reservations',
      }
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
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
