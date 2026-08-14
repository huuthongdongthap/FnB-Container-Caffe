import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchAdminTerminalNew } from '../StitchAdminTerminalNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => {
      const map: Record<string, string> = {
        'stitch.adminTerminal': 'Admin Terminal',
        'stitch.dashboard': 'Dashboard',
        'stitch.orders': 'Orders',
        'stitch.menu': 'Menu Management',
        'stitch.reports': 'Reports',
        'stitch.settings': 'Settings',
        'stitch.logout': 'Logout',
        'stitch.totalRevenue': 'Total Revenue',
        'stitch.todayOrders': 'Today\'s Orders',
        'stitch.avgOrder': 'Avg Order Value',
        'stitch.loading': 'Loading...',
      };
      return map[key ?? ''] ?? key ?? '';
    },
  }),
}));

vi.mock('lucide-react', () => ({
  LayoutDashboard: () => null,
  ShoppingCart: () => null,
  Coffee: () => null,
  BarChart3: () => null,
  Settings: () => null,
  LogOut: () => null,
  DollarSign: () => null,
  TrendingUp: () => null,
  Package: () => null,
  Loader2: () => null,
}));

describe('StitchAdminTerminalNew', () => {
  it('renders the admin terminal', () => {
    renderWithProviders(<StitchAdminTerminalNew />);
    expect(screen.getByText('Admin Terminal')).toBeTruthy();
  });

  it('renders sidebar navigation items', () => {
    renderWithProviders(<StitchAdminTerminalNew />);
    expect(screen.getByText('Dashboard')).toBeTruthy();
    expect(screen.getByText('Orders')).toBeTruthy();
    expect(screen.getByText('Menu Management')).toBeTruthy();
    expect(screen.getByText('Reports')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('renders stat cards', () => {
    renderWithProviders(<StitchAdminTerminalNew />);
    expect(screen.getByText('Total Revenue')).toBeTruthy();
    expect(screen.getByText("Today's Orders")).toBeTruthy();
    expect(screen.getByText('Avg Order Value')).toBeTruthy();
  });

  it('renders logout button', () => {
    renderWithProviders(<StitchAdminTerminalNew />);
    expect(screen.getByText('Logout')).toBeTruthy();
  });

  it('calls onLogout when logout is clicked', () => {
    const onLogout = vi.fn();
    renderWithProviders(<StitchAdminTerminalNew onLogout={onLogout} />);
    fireEvent.click(screen.getByText('Logout'));
    expect(onLogout).toHaveBeenCalled();
  });

  it('shows loading state', () => {
    renderWithProviders(<StitchAdminTerminalNew loading />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });
});
