import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { StitchAccountNew } from '../StitchAccountNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => {
      const map: Record<string, string> = {
        'stitch.account': 'My Account',
        'stitch.profile': 'Profile',
        'stitch.orders': 'Order History',
        'stitch.loyalty': 'Loyalty',
        'stitch.settings': 'Settings',
        'stitch.logout': 'Logout',
        'stitch.name': 'Name',
        'stitch.email': 'Email',
        'stitch.phone': 'Phone',
        'stitch.loading': 'Loading...',
        'stitch.error': 'Failed to load account',
      };
      return map[key ?? ''] ?? key ?? '';
    },
  }),
}));

vi.mock('lucide-react', () => ({
  User: () => null,
  Settings: () => null,
  LogOut: () => null,
  Clock: () => null,
  Gift: () => null,
  CreditCard: () => null,
  ChevronRight: () => null,
}));

describe('StitchAccountNew', () => {
  it('renders the account page', () => {
    renderWithProviders(<StitchAccountNew />);
    expect(screen.getByText('My Account')).toBeTruthy();
  });

  it('renders profile section', () => {
    renderWithProviders(<StitchAccountNew />);
    expect(screen.getByText('Profile')).toBeTruthy();
  });

  it('renders order history link', () => {
    renderWithProviders(<StitchAccountNew />);
    expect(screen.getByText('Order History')).toBeTruthy();
  });

  it('renders loyalty link', () => {
    renderWithProviders(<StitchAccountNew />);
    expect(screen.getByText('Loyalty')).toBeTruthy();
  });

  it('renders settings link', () => {
    renderWithProviders(<StitchAccountNew />);
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('renders logout button', () => {
    renderWithProviders(<StitchAccountNew />);
    expect(screen.getByText('Logout')).toBeTruthy();
  });
});
