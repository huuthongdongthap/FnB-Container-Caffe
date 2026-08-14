import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { StitchAdminTerminalNew } from '../StitchAdminTerminalNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => key ?? '',
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
  CreditCard: () => null,
  UtensilsCrossed: () => null,
  CalendarCheck: () => null,
  Users: () => null,
  UserCog: () => null,
  FileBarChart: () => null,
  Megaphone: () => null,
  Percent: () => null,
  Send: () => null,
  MessageSquare: () => null,
  ScrollText: () => null,
  ClipboardCheck: () => null,
  RefreshCw: () => null,
  Gem: () => null,
  Receipt: () => null,
  QrCode: () => null,
  Cake: () => null,
  Search: () => null,
  Bell: () => null,
  HelpCircle: () => null,
  Menu: () => null,
}));

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  Outlet: () => null,
  Link: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <span {...props}>{children}</span>,
  useLocation: () => ({ pathname: '/admin' }),
}));

describe('StitchAdminTerminalNew', () => {
  it('renders brand name and subtitle', () => {
    renderWithProviders(<StitchAdminTerminalNew />);
    expect(screen.getByText('Aura Cafe')).toBeTruthy();
    expect(screen.getByText('Admin Terminal')).toBeTruthy();
  });

  it('renders admin name', () => {
    renderWithProviders(<StitchAdminTerminalNew />);
    expect(screen.getByText('Aura Admin')).toBeTruthy();
  });

  it('renders sidebar nav items with Vietnamese labels', () => {
    renderWithProviders(<StitchAdminTerminalNew />);
    expect(screen.getByText('Đơn hàng')).toBeTruthy();
    expect(screen.getByText('POS')).toBeTruthy();
    expect(screen.getByText('Thực đơn')).toBeTruthy();
    expect(screen.getByText('Đặt bàn')).toBeTruthy();
    expect(screen.getByText('Khách hàng')).toBeTruthy();
    expect(screen.getByText('Nhân viên')).toBeTruthy();
  });

  it('renders analytics section nav items', () => {
    renderWithProviders(<StitchAdminTerminalNew />);
    expect(screen.getByText('Phân tích')).toBeTruthy();
    expect(screen.getByText('Báo cáo')).toBeTruthy();
  });

  it('renders section group titles', () => {
    renderWithProviders(<StitchAdminTerminalNew />);
    expect(screen.getByText('Vận hành / Operations')).toBeTruthy();
    expect(screen.getByText('Phân tích / Analytics')).toBeTruthy();
  });

  it('renders generate report button with i18n key', () => {
    renderWithProviders(<StitchAdminTerminalNew />);
    expect(screen.getByText('terminal.generateReport')).toBeTruthy();
  });

  it('renders logout button with i18n key', () => {
    renderWithProviders(<StitchAdminTerminalNew />);
    expect(screen.getByText('terminal.logout')).toBeTruthy();
  });
});
