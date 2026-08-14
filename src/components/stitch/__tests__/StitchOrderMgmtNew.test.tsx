import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchOrderMgmtNew } from '../StitchOrderMgmtNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => {
      const map: Record<string, string> = {
        'stitch.orderMgmt': 'Order Management',
        'stitch.search': 'Search orders...',
        'stitch.all': 'All',
        'stitch.pending': 'Pending',
        'stitch.preparing': 'Preparing',
        'stitch.ready': 'Ready',
        'stitch.delivered': 'Delivered',
        'stitch.cancelled': 'Cancelled',
        'stitch.noOrders': 'No orders found',
        'stitch.loading': 'Loading...',
        'stitch.error': 'Failed to load orders',
        'stitch.totalOrders': 'Total Orders',
        'stitch.pendingOrders': 'Pending',
        'stitch.completedOrders': 'Completed',
        'stitch.revenue': 'Revenue',
      };
      return map[key ?? ''] ?? key ?? '';
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
}));

describe('StitchOrderMgmtNew', () => {
  it('renders the order management page', () => {
    renderWithProviders(<StitchOrderMgmtNew />);
    expect(screen.getByText('Order Management')).toBeTruthy();
  });

  it('renders stat cards', () => {
    renderWithProviders(<StitchOrderMgmtNew />);
    expect(screen.getByText('Total Orders')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.getByText('Completed')).toBeTruthy();
    expect(screen.getByText('Revenue')).toBeTruthy();
  });

  it('renders search input', () => {
    renderWithProviders(<StitchOrderMgmtNew />);
    expect(screen.getByPlaceholderText('Search orders...')).toBeTruthy();
  });

  it('renders filter tabs', () => {
    renderWithProviders(<StitchOrderMgmtNew />);
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('Preparing')).toBeTruthy();
    expect(screen.getByText('Ready')).toBeTruthy();
    expect(screen.getByText('Delivered')).toBeTruthy();
  });

  it('shows loading state', () => {
    renderWithProviders(<StitchOrderMgmtNew loading />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('shows error state', () => {
    renderWithProviders(<StitchOrderMgmtNew error="Connection lost" />);
    expect(screen.getByText('Connection lost')).toBeTruthy();
  });

  it('shows empty state when no orders', () => {
    renderWithProviders(<StitchOrderMgmtNew orders={[]} />);
    expect(screen.getByText('No orders found')).toBeTruthy();
  });

  it('renders order rows with data', () => {
    renderWithProviders(
      <StitchOrderMgmtNew
        orders={[
          { id: '#1001', customer: 'John D.', items: '2x Espresso', status: 'pending', total: 13.0, time: '10:30' },
          { id: '#1002', customer: 'Jane S.', items: '1x Latte', status: 'preparing', total: 7.0, time: '10:35' },
        ]}
      />,
    );
    expect(screen.getByText('#1001')).toBeTruthy();
    expect(screen.getByText('#1002')).toBeTruthy();
    expect(screen.getByText('John D.')).toBeTruthy();
    expect(screen.getByText('Jane S.')).toBeTruthy();
  });

  it('filters orders by status', () => {
    renderWithProviders(
      <StitchOrderMgmtNew
        orders={[
          { id: '#1001', customer: 'John', items: 'Espresso', status: 'pending', total: 6.5, time: '10:00' },
          { id: '#1002', customer: 'Jane', items: 'Latte', status: 'ready', total: 7.0, time: '10:05' },
        ]}
      />,
    );
    fireEvent.click(screen.getByText('Ready'));
    expect(screen.getByText('#1002')).toBeTruthy();
    expect(screen.queryByText('#1001')).toBeNull();
  });
});
