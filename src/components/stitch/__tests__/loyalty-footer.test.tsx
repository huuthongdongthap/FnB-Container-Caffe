import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { LoyaltyFooter } from '../loyalty-footer';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'loyalty.footerPrivacy': 'Privacy Policy',
        'loyalty.footerTerms': 'Terms of Service',
        'loyalty.footerBlackTier': 'Black Tier Benefits',
        'loyalty.footerContact': 'Contact Concierge',
        'loyalty.footerCopyright': '© 2024 AURA CAFE. ALL RIGHTS RESERVED.',
      };
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
    },
  }),
}));

describe('LoyaltyFooter', () => {
  it('renders footer links', () => {
    renderWithProviders(<LoyaltyFooter />);
    expect(screen.getByText('Privacy Policy')).toBeTruthy();
    expect(screen.getByText('Terms of Service')).toBeTruthy();
    expect(screen.getByText('Black Tier Benefits')).toBeTruthy();
    expect(screen.getByText('Contact Concierge')).toBeTruthy();
  });

  it('renders copyright', () => {
    renderWithProviders(<LoyaltyFooter />);
    expect(screen.getByText('© 2024 AURA CAFE. ALL RIGHTS RESERVED.')).toBeTruthy();
  });
});
