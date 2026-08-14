import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { StitchAccountNew } from '../StitchAccountNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'stitch.accountDashboard.pageAriaLabel': 'Account Dashboard',
        'stitch.accountDashboard.appBarAriaLabel': 'App bar',
        'stitch.accountDashboard.openMenu': 'Open Menu',
        'stitch.accountDashboard.profileSectionAriaLabel': 'Profile',
        'stitch.accountDashboard.avatarAlt': 'Avatar of {{name}}',
        'stitch.accountDashboard.tierMember': '{{tier}} Member',
        'stitch.accountDashboard.loyaltySectionAriaLabel': 'Loyalty progress',
        'stitch.accountDashboard.currentBalance': 'Current Balance',
        'stitch.accountDashboard.pts': 'PTS',
        'stitch.accountDashboard.nextTier': 'Next Tier: {{tier}}',
        'stitch.accountDashboard.quickOrder': 'QUICK ORDER',
        'stitch.accountDashboard.recentTransactions': 'Recent Transactions',
        'stitch.accountDashboard.viewAll': 'View All',
        'stitch.accountDashboard.statusPreparing': 'PREPARING',
        'stitch.accountDashboard.statusDelivered': 'DELIVERED',
        'stitch.accountDashboard.navReserve': 'Reserve',
        'stitch.accountDashboard.navOrders': 'Orders',
        'stitch.accountDashboard.navLoyalty': 'Loyalty',
        'stitch.accountDashboard.navAccount': 'Account',
        'stitch.accountDashboard.failedToLoad': 'Failed to Load',
        'stitch.accountDashboard.errorDescription': 'Something went wrong',
        'stitch.accountDashboard.retry': 'Retry',
        'stitch.accountDashboard.noTransactionsYet': 'No transactions yet',
        'stitch.accountDashboard.noTransactionsDesc': 'Start ordering to see history',
      };
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
    },
  }),
}));

vi.mock('lucide-react', () => ({
  User: () => null,
  Coffee: () => null,
  CreditCard: () => null,
  Menu: () => null,
  Bell: () => null,
  Clock: () => null,
  Star: () => null,
  RefreshCw: () => null,
  UtensilsCrossed: () => null,
  CupSoda: () => null,
  IceCream: () => null,
  Medal: () => null,
  ReceiptText: () => null,
}));

describe('StitchAccountNew', () => {
  it('renders the account page with profile', () => {
    renderWithProviders(<StitchAccountNew />);
    expect(screen.getByText('Julian Vane')).toBeTruthy();
    expect(screen.getByText('AURA CAFE')).toBeTruthy();
  });

  it('renders loyalty progress', () => {
    renderWithProviders(<StitchAccountNew />);
    expect(screen.getByText('Current Balance')).toBeTruthy();
    expect(screen.getByText('1,250')).toBeTruthy();
  });

  it('renders recent orders', () => {
    renderWithProviders(<StitchAccountNew />);
    expect(screen.getByText('Truffle Cortado')).toBeTruthy();
    expect(screen.getByText('Gold Leaf Croissant')).toBeTruthy();
  });

  it('renders account cards', () => {
    renderWithProviders(<StitchAccountNew />);
    expect(screen.getByText('Aura Elite')).toBeTruthy();
    expect(screen.getByText('Visa •• 4242')).toBeTruthy();
  });

  it('renders bottom navigation', () => {
    renderWithProviders(<StitchAccountNew />);
    expect(screen.getByText('Account')).toBeTruthy();
    expect(screen.getByText('Orders')).toBeTruthy();
  });
});
