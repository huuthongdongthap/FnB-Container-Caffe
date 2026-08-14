import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { FeatureCardsSection } from '../stitch-container-new2-feature-cards';

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

const CARDS = [
  { id: 'c1', icon: 'architecture', title: 'Architectural Precision', description: 'Industrial containers refined with glass.' },
  { id: 'c2', icon: 'coffee_maker', title: 'Curated Brews', description: 'Finest specialty beans.' },
  { id: 'c3', icon: 'nights_stay', title: 'Nocturnal Ambience', description: 'Twilight lighting system.' },
];

describe('FeatureCardsSection', () => {
  it('renders section title', () => {
    renderWithProviders(<FeatureCardsSection sectionTitle="The Container Aesthetic" cards={CARDS} />);
    expect(screen.getByText('The Container Aesthetic')).toBeTruthy();
  });

  it('renders all three feature cards', () => {
    renderWithProviders(<FeatureCardsSection sectionTitle="Features" cards={CARDS} />);
    expect(screen.getByText('Architectural Precision')).toBeTruthy();
    expect(screen.getByText('Curated Brews')).toBeTruthy();
    expect(screen.getByText('Nocturnal Ambience')).toBeTruthy();
  });

  it('renders card descriptions', () => {
    renderWithProviders(<FeatureCardsSection sectionTitle="Features" cards={CARDS} />);
    expect(screen.getByText('Industrial containers refined with glass.')).toBeTruthy();
    expect(screen.getByText('Finest specialty beans.')).toBeTruthy();
    expect(screen.getByText('Twilight lighting system.')).toBeTruthy();
  });

  it('renders empty state when no cards', () => {
    const { container } = renderWithProviders(<FeatureCardsSection sectionTitle="Empty" cards={[]} />);
    const grid = container.querySelector('.grid');
    expect(grid?.children.length).toBe(0);
  });

  it('sets aria-labelledby on section', () => {
    renderWithProviders(<FeatureCardsSection sectionTitle="Features" cards={CARDS} />);
    const section = screen.getByRole('region', { name: 'Features' });
    expect(section).toBeTruthy();
  });
});
