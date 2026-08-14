import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { LoyaltyEmpty } from '../loyalty-empty-state';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'loyalty.emptyTitle': 'No Loyalty Data',
        'loyalty.emptyDescription': 'Start earning points today!',
      };
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
    },
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
