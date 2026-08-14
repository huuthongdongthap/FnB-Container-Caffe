import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { StitchHeroNew } from '../StitchHeroNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {};
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
  ArrowRight: () => null,
}));

// brandName appears in nav + footer, use getAllByText
// CTA buttons: t('hero.bookTable', 'Book Your Table'), t('hero.exploreMenu', 'Explore Menu')
// Description: t('hero.description', 'A redefined coffee experience...')

describe('StitchHeroNew', () => {
  it('renders the hero brand name', () => {
    renderWithProviders(<StitchHeroNew />);
    // Brand appears in nav header + footer
    expect(screen.getAllByText('AURA CAFE').length).toBeGreaterThanOrEqual(2);
  });

  it('renders with custom brand name', () => {
    renderWithProviders(<StitchHeroNew brandName="MY BRAND" />);
    expect(screen.getAllByText('MY BRAND').length).toBeGreaterThanOrEqual(1);
  });

  it('renders with custom background image', () => {
    const { container } = renderWithProviders(
      <StitchHeroNew bgImageUrl="https://example.com/hero.jpg" />,
    );
    expect(container).toBeTruthy();
  });

  it('renders CTA buttons', () => {
    renderWithProviders(<StitchHeroNew />);
    // t('hero.bookTable', 'Book Your Table') returns fallback
    expect(screen.getByText('Book Your Table')).toBeTruthy();
    expect(screen.getByText('Explore Menu')).toBeTruthy();
  });

  it('renders hero description', () => {
    renderWithProviders(<StitchHeroNew />);
    // t('hero.description', 'A redefined coffee experience...') returns fallback
    expect(screen.getByText(/redefined coffee experience/)).toBeTruthy();
  });
});
