import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchOrderMgmtNew } from '../StitchOrderMgmtNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'terminal.showingOrders': 'Showing {current} of {total} orders',
        'terminal.page': 'Page {n}',
      };
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
    },
  }),
}));

vi.mock('lucide-react', () => ({
  Search: () => null,
  Clock: () => null,
  CheckCircle: () => null,
  XCircle: () => null,
  Package: () => null,
  MoreVertical: () => null,
  Filter: () => null,
  ArrowUpDown: () => null,
  AlertCircle: () => null,
  DollarSign: () => null,
  TrendingUp: () => null,
  Users: () => null,
  LayoutGrid: () => null,
  Loader2: () => null,
  LayoutDashboard: () => null,
  Receipt: () => null,
  Settings: () => null,
  LogOut: () => null,
  Bell: () => null,
  HelpCircle: () => null,
  ChevronLeft: () => null,
  ChevronRight: () => null,
  Menu: () => null,
  UtensilsCrossed: () => null,
  Ban: () => null,
  RefreshCw: () => null,
  ChartBar: () => null,
  Timer: () => null,
  UserPlus: () => null,
  Tag: () => null,
}));

describe('StitchOrderMgmtNew', () => {
  it('renders the order management page', () => {
    renderWithProviders(<StitchOrderMgmtNew />);
    expect(screen.getByLabelText('terminal.mainContent')).toBeTruthy();
  });

  it('renders stat cards with their labels', () => {
    renderWithProviders(<StitchOrderMgmtNew />);
    expect(screen.getByText('Active Orders')).toBeTruthy();
    expect(screen.getByText('In Preparation')).toBeTruthy();
    expect(screen.getByText('Ready for Pickup')).toBeTruthy();
    expect(screen.getByText('Avg. Lead Time')).toBeTruthy();
  });

  it('renders search input with i18n key', () => {
    renderWithProviders(<StitchOrderMgmtNew />);
    expect(screen.getByPlaceholderText('terminal.searchPlaceholder')).toBeTruthy();
  });

  it('renders filter tabs with i18n keys', () => {
    renderWithProviders(<StitchOrderMgmtNew />);
    expect(screen.getByText('orderMgmt.all')).toBeTruthy();
    // These appear in both filter tabs AND status badges of default orders
    expect(screen.getAllByText('orderMgmt.preparing').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('orderMgmt.ready').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('orderMgmt.served').length).toBeGreaterThanOrEqual(2);
  });

  it('shows loading state when isLoading is true', () => {
    renderWithProviders(<StitchOrderMgmtNew isLoading />);
    expect(screen.getByText('terminal.loading')).toBeTruthy();
  });

  it('shows error state with error message', () => {
    renderWithProviders(<StitchOrderMgmtNew error="Connection lost" />);
    expect(screen.getByText('Connection lost')).toBeTruthy();
  });

  it('shows empty state when no orders', () => {
    renderWithProviders(<StitchOrderMgmtNew orders={[]} />);
    expect(screen.getByText('terminal.noOrders')).toBeTruthy();
  });

  it('renders order rows with data', () => {
    renderWithProviders(
      <StitchOrderMgmtNew
        orders={[
          { id: '#1001', customer: 'John D.', table: 'T1', timeAgo: '2m', status: 'pending', items: [{ name: 'Espresso', quantity: 2 }], total: '$13.00' },
          { id: '#1002', customer: 'Jane S.', table: 'T2', timeAgo: '5m', status: 'preparing', items: [{ name: 'Latte', quantity: 1 }], total: '$7.00' },
        ]}
      />,
    );
    expect(screen.getByText('#1001')).toBeTruthy();
    expect(screen.getByText('#1002')).toBeTruthy();
    expect(screen.getByText('John D.')).toBeTruthy();
    expect(screen.getByText('Jane S.')).toBeTruthy();
  });

  it('renders real pagination counts and invokes onPageChange without hardcoded 6/124 or fake shift names', () => {
    const onPageChange = vi.fn();
    renderWithProviders(
      <StitchOrderMgmtNew
        orders={[
          { id: '#1001', customer: 'John D.', table: 'T1', timeAgo: '2m', status: 'pending', items: [{ name: 'Espresso', quantity: 2 }], total: '$13.00' },
          { id: '#1002', customer: 'Jane S.', table: 'T2', timeAgo: '5m', status: 'preparing', items: [{ name: 'Latte', quantity: 1 }], total: '$7.00' },
        ]}
        currentPage={2}
        pageSize={2}
        totalCount={5}
        onPageChange={onPageChange}
      />,
    );

    expect(screen.getByText('Showing 2 of 5 orders')).toBeTruthy();
    expect(screen.queryByText(/Showing 6 of 124/)).toBeNull();
    expect(screen.queryByText('Sarah J.')).toBeNull();
    expect(screen.queryByText('Buy 1 Get 1 Mocha')).toBeNull();

    fireEvent.click(screen.getByLabelText('terminal.prevPage'));
    expect(onPageChange).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByLabelText('terminal.nextPage'));
    expect(onPageChange).toHaveBeenCalledWith(3);

    fireEvent.click(screen.getByLabelText('Page 1'));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });
});
