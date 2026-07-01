import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test-utils';
import { StatsCard } from '@/components/admin/StatsCard';
import { OrderTable } from '@/components/admin/OrderTable';

describe('StatsCard', () => {
  const mockStats = {
    todayRevenue: 12500000,
    todayOrders: 42,
    activeCustomers: 18,
    avgOrderValue: 297619,
  };

  it('renders revenue with VND currency format', () => {
    render(
      <StatsCard
        title="Doanh thu hôm nay"
        value={mockStats.todayRevenue}
        type="revenue"
      />
    );
    expect(screen.getByText(/12\.?500\.?000/)).toBeInTheDocument();
    const values = screen.getAllByText(/₫|vnd|VND/i);
    expect(values.length).toBeGreaterThan(0);
  });

  it('renders order count', () => {
    render(
      <StatsCard
        title="Đơn hàng"
        value={mockStats.todayOrders}
        type="count"
      />
    );
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders customer count', () => {
    render(
      <StatsCard
        title="Khách hàng"
        value={mockStats.activeCustomers}
        type="count"
      />
    );
    expect(screen.getByText('18')).toBeInTheDocument();
  });

  it('renders average order value', () => {
    render(
      <StatsCard
        title="Giá trị TB"
        value={mockStats.avgOrderValue}
        type="revenue"
      />
    );
    expect(screen.getByText(/297\.?619/)).toBeInTheDocument();
  });

  it('accepts custom className', () => {
    const { container } = render(
      <StatsCard
        title="Test"
        value={100}
        type="count"
        className="custom-card"
      />
    );
    const cardRoot = container.firstElementChild;
    expect(cardRoot?.className).toContain('custom-card');
  });
});

describe('OrderTable', () => {
  const mockOrders = [
    {
      id: 'ORD-001',
      customer: 'Nguyen Van A',
      items: 3,
      total: 185000,
      status: 'pending',
      payment: 'cash',
      createdAt: '2026-07-01T09:00:00Z',
    },
    {
      id: 'ORD-002',
      customer: 'Tran Thi B',
      items: 1,
      total: 55000,
      status: 'delivered',
      payment: 'momo',
      createdAt: '2026-07-01T08:30:00Z',
    },
    {
      id: 'ORD-003',
      customer: 'Le Van C',
      items: 5,
      total: 420000,
      status: 'preparing',
      payment: 'bank',
      createdAt: '2026-07-01T10:00:00Z',
    },
  ];

  it('renders all orders', () => {
    render(<OrderTable orders={mockOrders} />);
    expect(screen.getByText('ORD-001')).toBeInTheDocument();
    expect(screen.getByText('ORD-002')).toBeInTheDocument();
    expect(screen.getByText('ORD-003')).toBeInTheDocument();
  });

  it('filters by status', () => {
    render(<OrderTable orders={mockOrders} statusFilter="delivered" />);
    expect(screen.getByText('ORD-002')).toBeInTheDocument();
    expect(screen.queryByText('ORD-001')).not.toBeInTheDocument();
  });

  it('filters by payment method', () => {
    render(<OrderTable orders={mockOrders} paymentFilter="momo" />);
    expect(screen.getByText('ORD-002')).toBeInTheDocument();
    expect(screen.queryByText('ORD-001')).not.toBeInTheDocument();
  });

  it('sorts by date (newest first)', () => {
    render(<OrderTable orders={mockOrders} sortBy="date" />);
    const rows = screen.getAllByRole('row');
    expect(rows[1]?.textContent).toContain('ORD-003');
  });

  it('shows status badges with correct variant', () => {
    render(<OrderTable orders={mockOrders} />);
    const pendingBadge = screen.getByText('pending').closest('span');
    expect(pendingBadge?.className).toContain('bg-amber');
    const deliveredBadge = screen.getByText('delivered').closest('span');
    expect(deliveredBadge?.className).toContain('bg-green');
  });

  it('shows empty state when no matching orders', () => {
    render(<OrderTable orders={[]} />);
    expect(screen.getByText(/không có đơn/i)).toBeInTheDocument();
  });

  it('searches by order ID or customer name', () => {
    render(<OrderTable orders={mockOrders} searchQuery="ORD-001" />);
    expect(screen.getByText('ORD-001')).toBeInTheDocument();
    expect(screen.queryByText('ORD-002')).not.toBeInTheDocument();
  });
});
