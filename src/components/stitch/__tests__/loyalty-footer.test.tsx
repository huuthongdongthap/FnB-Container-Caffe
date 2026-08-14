import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { LoyaltyFooter } from '../loyalty-footer';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => ({
      'loyalty.footerText': 'AURA CAFE Loyalty',
      'loyalty.footerCopy': '2024 AURA CAFE. All rights reserved.',
    }[key ?? ''] ?? key ?? ''),
  }),
}));

describe('LoyaltyFooter', () => {
  it('renders the footer', () => {
    renderWithProviders(<LoyaltyFooter />);
    expect(screen.getByText('AURA CAFE Loyalty')).toBeTruthy();
  });

  it('renders copyright text', () => {
    renderWithProviders(<LoyaltyFooter />);
    expect(screen.getByText('2024 AURA CAFE. All rights reserved.')).toBeTruthy();
  });
});
