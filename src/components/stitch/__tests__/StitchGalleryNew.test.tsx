import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { StitchGalleryNew } from '../StitchGalleryNew';

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
  Menu: () => null,
  ShoppingBag: () => null,
  Home: () => null,
  Grid3x3: () => null,
  UtensilsCrossed: () => null,
  ArmchairIcon: () => null,
  ArrowUpRight: () => null,
}));

describe('StitchGalleryNew', () => {
  it('renders the gallery page header', () => {
    renderWithProviders(<StitchGalleryNew />);
    expect(screen.getByText('Design Showcase')).toBeTruthy();
    expect(screen.getByText('AURA CAFE')).toBeTruthy();
  });

  it('renders filter buttons', () => {
    renderWithProviders(<StitchGalleryNew />);
    expect(screen.getByText('ALL')).toBeTruthy();
    expect(screen.getByText('INDUSTRIAL')).toBeTruthy();
    expect(screen.getByText('LUXURY')).toBeTruthy();
    expect(screen.getByText('TECH')).toBeTruthy();
  });

  it('renders default gallery items', () => {
    renderWithProviders(<StitchGalleryNew />);
    expect(screen.getByText('PRECISION POS')).toBeTruthy();
    expect(screen.getByText('KINETIC KITCHEN')).toBeTruthy();
  });

  it('renders load more button', () => {
    renderWithProviders(<StitchGalleryNew />);
    expect(screen.getByText('LOAD MORE ARCHIVES')).toBeTruthy();
  });

  it('renders bottom navigation', () => {
    renderWithProviders(<StitchGalleryNew />);
    expect(screen.getByText('HOME')).toBeTruthy();
    expect(screen.getByText('GALLERY')).toBeTruthy();
    expect(screen.getByText('MENU')).toBeTruthy();
    expect(screen.getByText('RESERVE')).toBeTruthy();
  });
});
