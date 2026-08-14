import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { LoyaltyHeader } from '../loyalty-header';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'loyalty.navTiers': 'Tiers',
        'loyalty.navRewards': 'Rewards',
        'loyalty.navLounge': 'Lounge',
        'loyalty.navConcierge': 'Concierge',
        'loyalty.membership': 'Membership',
        'loyalty.profileAvatar': 'Profile',
      };
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
    },
  }),
}));

describe('LoyaltyHeader', () => {
  it('renders the brand name', () => {
    renderWithProviders(<LoyaltyHeader />);
    expect(screen.getByText('AURA CAFE')).toBeTruthy();
  });

  it('renders nav items', () => {
    renderWithProviders(<LoyaltyHeader />);
    expect(screen.getByText('Tiers')).toBeTruthy();
    expect(screen.getByText('Rewards')).toBeTruthy();
    expect(screen.getByText('Lounge')).toBeTruthy();
    expect(screen.getByText('Concierge')).toBeTruthy();
  });

  it('renders membership button', () => {
    renderWithProviders(<LoyaltyHeader />);
    expect(screen.getByText('Membership')).toBeTruthy();
  });
});
