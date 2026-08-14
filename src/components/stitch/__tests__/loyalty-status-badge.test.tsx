import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { StatusBadge } from '../loyalty-status-badge';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => ({
      'loyalty.completed': 'Completed',
      'loyalty.pending': 'Pending',
      'loyalty.expired': 'Expired',
    }[key ?? ''] ?? key ?? ''),
  }),
}));

describe('StatusBadge', () => {
  it('renders completed status', () => {
    renderWithProviders(<StatusBadge status="completed" />);
    expect(screen.getByText('Completed')).toBeTruthy();
  });

  it('renders pending status', () => {
    renderWithProviders(<StatusBadge status="pending" />);
    expect(screen.getByText('Pending')).toBeTruthy();
  });

  it('renders expired status', () => {
    renderWithProviders(<StatusBadge status="expired" />);
    expect(screen.getByText('Expired')).toBeTruthy();
  });
});
