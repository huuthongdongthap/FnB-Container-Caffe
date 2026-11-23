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
  it('renders mock-free default profile', () => {
    renderWithProviders(<StitchAccountNew />);
    expect(screen.getByText('Khách hàng')).toBeTruthy();
    expect(screen.queryByText('Julian Vane')).toBeNull();
  });

  it('renders loyalty progress with explicit loyalty props', () => {
    renderWithProviders(
      <StitchAccountNew
        loyalty={{ points: 1250, nextTier: 'Platinum', pointsToNext: 250, progressPercent: 83 }}
      />,
    );
    expect(screen.getByText('Current Balance')).toBeTruthy();
    expect(screen.getByText('1,250')).toBeTruthy();
  });

  it('renders recent orders when provided', () => {
    renderWithProviders(
      <StitchAccountNew
        orders={[
          { id: 'ORD-1', itemName: 'Cà Phê Sữa Đá', icon: 'coffee', time: '5m ago', status: 'delivered' },
          { id: 'ORD-2', itemName: 'Bánh Sừng Bò', icon: 'bakery', time: '1h ago', status: 'delivered' },
        ]}
      />,
    );
    expect(screen.getByText('Cà Phê Sữa Đá')).toBeTruthy();
    expect(screen.getByText('Bánh Sừng Bò')).toBeTruthy();
  });

  it('renders account cards when provided', () => {
    renderWithProviders(
      <StitchAccountNew
        cards={[
          { type: 'subscription', title: 'Aura Member', subtitle: 'Active', meta: 'Monthly', accent: true },
        ]}
      />,
    );
    expect(screen.getByText('Aura Member')).toBeTruthy();
  });

  it('renders quick order button', () => {
    renderWithProviders(<StitchAccountNew />);
    expect(screen.getByText('QUICK ORDER')).toBeTruthy();
  });
});
