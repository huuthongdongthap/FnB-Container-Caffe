import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { LoyaltyFooter } from '../loyalty-footer';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'loyalty.brandFooter': 'AURA CAFE Loyalty',
        'loyalty.termsApply': 'Terms and conditions apply',
        'loyalty.pointsExpire': 'Points expire after 12 months of inactivity',
        'loyalty.copyright': '2024 AURA CAFE. All rights reserved.',
      };
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
    },
  }),
}));

describe('LoyaltyFooter', () => {
  it('renders the footer brand name', () => {
    renderWithProviders(<LoyaltyFooter />);
    expect(screen.getByText('AURA CAFE Loyalty')).toBeTruthy();
  });

  it('renders terms info', () => {
    renderWithProviders(<LoyaltyFooter />);
    expect(screen.getByText('Terms and conditions apply')).toBeTruthy();
  });

  it('renders points expiry info', () => {
    renderWithProviders(<LoyaltyFooter />);
    expect(screen.getByText('Points expire after 12 months of inactivity')).toBeTruthy();
  });

  it('renders copyright', () => {
    renderWithProviders(<LoyaltyFooter />);
    expect(screen.getByText('2024 AURA CAFE. All rights reserved.')).toBeTruthy();
  });
});
