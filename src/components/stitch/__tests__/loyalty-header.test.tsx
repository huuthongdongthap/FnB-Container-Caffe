import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { LoyaltyHeader } from '../loyalty-header';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => ({
      'loyalty.headerTitle': 'Loyalty Program',
      'loyalty.headerSubtitle': 'Earn points and unlock rewards',
    }[key ?? ''] ?? key ?? ''),
  }),
}));

describe('LoyaltyHeader', () => {
  it('renders the loyalty header', () => {
    renderWithProviders(<LoyaltyHeader />);
    expect(screen.getByText('Loyalty Program')).toBeTruthy();
    expect(screen.getByText('Earn points and unlock rewards')).toBeTruthy();
  });

  it('applies custom className', () => {
    const { container } = renderWithProviders(
      <LoyaltyHeader className="custom-header" />,
    );
    expect(container.querySelector('.custom-header')).toBeTruthy();
  });
});
