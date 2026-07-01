import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test-utils';
import { TicketQueue } from '@/components/kds/TicketQueue';
import { OrderTicket } from '@/components/kds/OrderTicket';
import { OrderCompleteButton } from '@/components/kds/OrderCompleteButton';
import type { KDSOrder } from '@/hooks/use-kds';

const mockPendingOrders: KDSOrder[] = [
  {
    id: 'ORD-001',
    table: '5',
    items: [
      { name: 'Cà phê sữa', quantity: 2, modifiers: ['Ít đá'], notes: '' },
      { name: 'Bánh mì', quantity: 1, modifiers: [], notes: 'Không hành' },
    ],
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    status: 'pending',
  },
  {
    id: 'ORD-002',
    table: '3',
    items: [
      { name: 'Trà sen', quantity: 1, modifiers: [], notes: '' },
    ],
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    status: 'pending',
  },
  {
    id: 'ORD-003',
    table: '7',
    items: [
      { name: 'Sinh tố bơ', quantity: 1, modifiers: [], notes: '' },
    ],
    createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    status: 'preparing',
  },
];

describe('TicketQueue', () => {
  it('renders pending orders sorted by time (oldest first)', () => {
    render(<TicketQueue orders={mockPendingOrders} station="all" />);
    // In column view with "all" station, headers show column names
    expect(screen.getByText('Chờ xác nhận')).toBeInTheDocument();
    expect(screen.getByText('Đang chuẩn bị')).toBeInTheDocument();
    expect(screen.getByText('Sẵn sàng')).toBeInTheDocument();
    // The pending column should have ORD-002 and ORD-001
    expect(screen.getByText('Bàn 5')).toBeInTheDocument();
    expect(screen.getByText('Bàn 3')).toBeInTheDocument();
  });

  it('filters by station (drinks/food)', () => {
    render(<TicketQueue orders={mockPendingOrders} station="drinks" />);
    // In single station view, orders are shown without column headers
    const items = screen.getAllByText(/Cà phê sữa|Trà sen|Sinh tố bơ/);
    expect(items.length).toBeGreaterThan(0);
  });

  it('shows empty state when no pending orders', () => {
    render(<TicketQueue orders={[]} station="all" />);
    expect(screen.getByText(/không có đơn hàng/i)).toBeInTheDocument();
  });

  it('shows loading skeleton when loading', () => {
    render(<TicketQueue orders={[]} station="all" loading={true} />);
    const skeleton = screen.getByTestId('skeleton');
    expect(skeleton).toBeInTheDocument();
  });

  it('renders with orders passing onComplete handler', () => {
    const onComplete = vi.fn();
    render(
      <TicketQueue
        orders={mockPendingOrders}
        station="all"
        onComplete={onComplete}
      />
    );
    // Should render table numbers for all three orders
    expect(screen.getByText('Bàn 5')).toBeInTheDocument();
    expect(screen.getByText('Bàn 3')).toBeInTheDocument();
    expect(screen.getByText('Bàn 7')).toBeInTheDocument();
  });
});

describe('OrderTicket', () => {
  it('displays order items with quantities', () => {
    render(
      <OrderTicket
        order={mockPendingOrders[0]!}
      />
    );
    expect(screen.getByText('Cà phê sữa')).toBeInTheDocument();
    expect(screen.getByText('x2')).toBeInTheDocument();
    expect(screen.getByText('Bánh mì')).toBeInTheDocument();
  });

  it('shows modifiers for items', () => {
    render(
      <OrderTicket
        order={mockPendingOrders[0]!}
      />
    );
    expect(screen.getByText('Ít đá')).toBeInTheDocument();
  });

  it('shows item notes', () => {
    render(
      <OrderTicket
        order={mockPendingOrders[0]!}
      />
    );
    expect(screen.getByText(/Không hành/)).toBeInTheDocument();
  });

  it('displays elapsed time in minutes', () => {
    render(
      <OrderTicket
        order={mockPendingOrders[0]!}
      />
    );
    const elapsedText = screen.getByText(/\d+m/);
    expect(elapsedText).toBeInTheDocument();
  });

  it('shows red background when elapsed exceeds 15 minutes', () => {
    const oldOrder: KDSOrder = {
      ...mockPendingOrders[0]!,
      id: 'ORD-OLD',
      createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      status: 'pending',
    };
    render(<OrderTicket order={oldOrder} />);
    const ticket = screen.getByTestId('order-ticket');
    expect(ticket.className).toContain('bg-red');
  });

  it('shows table number prominently', () => {
    render(
      <OrderTicket
        order={mockPendingOrders[0]!}
      />
    );
    expect(screen.getByText(/Bàn 5/)).toBeInTheDocument();
  });

  it('renders without modifiers when none exist', () => {
    render(
      <OrderTicket
        order={mockPendingOrders[1]!}
      />
    );
    expect(screen.getByText('Trà sen')).toBeInTheDocument();
  });
});

describe('OrderCompleteButton', () => {
  it('shows button initially', () => {
    const onConfirm = vi.fn();
    render(
      <OrderCompleteButton orderId="ORD-001" onConfirm={onConfirm} />
    );
    expect(screen.getByText('Hoàn thành')).toBeInTheDocument();
  });

  it('confirms and calls onConfirm', () => {
    const onConfirm = vi.fn();
    render(
      <OrderCompleteButton orderId="ORD-001" onConfirm={onConfirm} />
    );
    fireEvent.click(screen.getByText('Hoàn thành'));
    const confirmBtn = screen.getByText('Xác nhận');
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledWith('ORD-001');
  });

  it('allows cancelling the confirmation', () => {
    const onConfirm = vi.fn();
    render(
      <OrderCompleteButton orderId="ORD-001" onConfirm={onConfirm} />
    );
    fireEvent.click(screen.getByText('Hoàn thành'));
    fireEvent.click(screen.getByText('Hủy'));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
