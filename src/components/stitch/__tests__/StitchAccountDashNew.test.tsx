import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { StitchAccountDashNew } from '../StitchAccountDashNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => {
      const map: Record<string, string> = {
        'stitch.accountDash': 'Account Dashboard',
        'stitch.profile': 'Profile',
        'stitch.orderHistory': 'Order History',
        'stitch.loyalty': 'Loyalty',
        'stitch.referral': 'Referral',
        'stitch.settings': 'Settings',
        'stitch.logout': 'Logout',
        'stitch.loading': 'Loading...',
        'stitch.error': 'Failed to load',
        'stitch.welcome': 'Welcome',
        'stitch.memberSince': 'Member since',
        'stitch.totalSpent': 'Total Spent',
        'stitch.ordersPlaced': 'Orders Placed',
        'stitch.rewardsEarned': 'Rewards Earned',
      };
      return map[key ?? ''] ?? key ?? '';
    },
  }),
}));

vi.mock('lucide-react', () => ({
  User: () => null,
  ShoppingBag: () => null,
  Gift: () => null,
  Star: () => null,
  Settings: () => null,
  LogOut: () => null,
  ChevronRight: () => null,
  Clock: () => null,
  CreditCard: () => null,
  LayoutDashboard: () => null,
}));

describe('StitchAccountDashNew', () => {
  it('renders the account dashboard', () => {
    renderWithProviders(<StitchAccountDashNew />);
    expect(screen.getByText('Account Dashboard')).toBeTruthy();
  });

  it('renders profile section', () => {
    renderWithProviders(<StitchAccountDashNew />);
    expect(screen.getByText('Profile')).toBeTruthy();
  });

  it('renders order history link', () => {
    renderWithProviders(<StitchAccountDashNew />);
    expect(screen.getByText('Order History')).toBeTruthy();
  });

  it('renders loyalty link', () => {
    renderWithProviders(<StitchAccountDashNew />);
    expect(screen.getByText('Loyalty')).toBeTruthy();
  });

  it('renders settings link', () => {
    renderWithProviders(<StitchAccountDashNew />);
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('renders stat cards', () => {
    renderWithProviders(<StitchAccountDashNew />);
    expect(screen.getByText('Total Spent')).toBeTruthy();
    expect(screen.getByText('Orders Placed')).toBeTruthy();
    expect(screen.getByText('Rewards Earned')).toBeTruthy();
  });

  it('shows loading state', () => {
    renderWithProviders(<StitchAccountDashNew loading />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('shows error state', () => {
    renderWithProviders(<StitchAccountDashNew error="Failed to load" />);
    expect(screen.getByText('Failed to load')).toBeTruthy();
  });
});
