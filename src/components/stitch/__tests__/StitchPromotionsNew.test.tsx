import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { StitchPromotionsNew } from '../StitchPromotionsNew';

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
  Clock: () => null,
  ArrowRight: () => null,
  Lock: () => null,
  Zap: () => null,
}));

describe('StitchPromotionsNew', () => {
  it('renders hero promotion', () => {
    renderWithProviders(<StitchPromotionsNew />);
    expect(screen.getByText('The Nocturnal Reserve')).toBeTruthy();
    expect(screen.getByText('Limited Release')).toBeTruthy();
  });

  it('renders active offers', () => {
    renderWithProviders(<StitchPromotionsNew />);
    expect(screen.getByText('Golden Hour Ritual')).toBeTruthy();
    expect(screen.getByText('Inner Circle Exclusive')).toBeTruthy();
    expect(screen.getByText('Weekend Solace')).toBeTruthy();
  });

  it('renders newsletter section', () => {
    renderWithProviders(<StitchPromotionsNew />);
    expect(screen.getByText('Join the Inner Circle')).toBeTruthy();
    expect(screen.getByText('Authenticate')).toBeTruthy();
  });

  it('renders claim offer button', () => {
    renderWithProviders(<StitchPromotionsNew />);
    expect(screen.getByText('Claim Offer')).toBeTruthy();
  });

  it('renders bottom navigation', () => {
    renderWithProviders(<StitchPromotionsNew />);
    expect(screen.getByText('Promotions')).toBeTruthy();
    expect(screen.getByText('Menu')).toBeTruthy();
    expect(screen.getByText('Account')).toBeTruthy();
  });
});
