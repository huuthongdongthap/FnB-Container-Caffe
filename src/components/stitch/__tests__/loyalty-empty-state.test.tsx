import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { LoyaltyEmpty } from '../loyalty-empty-state';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => ({
      'loyalty.emptyTitle': 'No Loyalty Data',
      'loyalty.emptyDescription': 'Start earning points today!',
    }[key ?? ''] ?? key ?? ''),
  }),
}));

vi.mock('lucide-react', () => ({
  Gift: () => null,
}));

describe('LoyaltyEmpty', () => {
  it('renders empty state', () => {
    renderWithProviders(<LoyaltyEmpty />);
    expect(screen.getByText('No Loyalty Data')).toBeTruthy();
    expect(screen.getByText('Start earning points today!')).toBeTruthy();
  });

  it('has role="status" for accessibility', () => {
    renderWithProviders(<LoyaltyEmpty />);
    expect(screen.getByRole('status')).toBeTruthy();
  });
});
