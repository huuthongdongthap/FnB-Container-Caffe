import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { StitchAccountNew } from '../StitchAccountNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'stitch.accountDashboard.appBarAriaLabel': 'App Bar Aria Label',
        'stitch.accountDashboard.currentBalance': 'Current Balance',
        'stitch.accountDashboard.errorDescription': 'Error Description',
        'stitch.accountDashboard.failedToLoad': 'Failed To Load',
        'stitch.accountDashboard.loyaltySectionAriaLabel': 'Loyalty Section Aria Label',
        'stitch.accountDashboard.navAccount': 'Nav Account',
        'stitch.accountDashboard.navAriaLabel': 'Nav Aria Label',
        'stitch.accountDashboard.navLoyalty': 'Nav Loyalty',
        'stitch.accountDashboard.navOrders': 'Nav Orders',
        'stitch.accountDashboard.navReserve': 'Nav Reserve',
        'stitch.accountDashboard.noTransactionsDesc': 'No Transactions Desc',
        'stitch.accountDashboard.noTransactionsYet': 'No Transactions Yet',
        'stitch.accountDashboard.openMenu': 'Open Menu',
        'stitch.accountDashboard.pageAriaLabel': 'Page Aria Label',
        'stitch.accountDashboard.profileSectionAriaLabel': 'Profile Section Aria Label',
        'stitch.accountDashboard.pts': 'Pts',
        'stitch.accountDashboard.quickOrder': 'Quick Order',
        'stitch.accountDashboard.recentTransactions': 'Recent Transactions',
        'stitch.accountDashboard.retry': 'Retry',
        'stitch.accountDashboard.statusDelivered': 'Status Delivered',
        'stitch.accountDashboard.statusPreparing': 'Status Preparing',
        'stitch.accountDashboard.viewAll': 'View All',
      }
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
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
