import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { LoyaltyHeader } from '../loyalty-header';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'loyalty.title': 'AURA CAFE Loyalty',
        'loyalty.subtitle': 'Earn points with every purchase',
        'loyalty.tierBronze': 'Bronze',
        'loyalty.tierSilver': 'Silver',
        'loyalty.tierGold': 'Gold',
        'loyalty.tierPlatinum': 'Platinum',
      };
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
    },
  }),
}));

describe('LoyaltyHeader', () => {
  it('renders the loyalty header title', () => {
    renderWithProviders(<LoyaltyHeader />);
    expect(screen.getByText('AURA CAFE Loyalty')).toBeTruthy();
  });

  it('renders subtitle', () => {
    renderWithProviders(<LoyaltyHeader />);
    expect(screen.getByText('Earn points with every purchase')).toBeTruthy();
  });

  it('applies custom className', () => {
    const { container } = renderWithProviders(
      <LoyaltyHeader className="custom-header" />,
    );
    expect(container.querySelector('.custom-header')).toBeTruthy();
  });
});
