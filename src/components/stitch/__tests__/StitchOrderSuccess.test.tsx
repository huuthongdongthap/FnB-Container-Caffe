import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test-utils';
import StitchOrderSuccess from '@/components/stitch/StitchOrderSuccess';
import type { OrderSuccessData } from '@/components/stitch/StitchOrderSuccess';

const BASE_ORDER: OrderSuccessData = {
  orderId: 'ORD-12345',
  customerName: 'John Doe',
  phone: '0912345678',
  notes: 'Extra foam on latte',
  table: 'B01',
  items: [
    { id: '1', name: 'Midnight Espresso', variant: 'Hot', quantity: 2, price: 6.50 },
    { id: '2', name: 'Smoked Truffle Croissant', variant: 'Regular', quantity: 1, price: 9.00 },
  ],
  subtotal: 22.00,
  tax: 1.10,
  total: 23.10,
  estimatedMinutes: 15,
  currentStatus: 'preparing',
  placedAt: new Date().toISOString(),
};

describe('StitchOrderSuccess', () => {
  it('renders loading skeleton', () => {
    const { container } = render(<StitchOrderSuccess order={null} isLoading={true} />);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(<StitchOrderSuccess order={null} error="Payment failed" />);
    expect(screen.getByText('Payment failed')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    const { container } = render(<StitchOrderSuccess order={null} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders order data', () => {
    render(<StitchOrderSuccess order={BASE_ORDER} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('#ORD-12345')).toBeInTheDocument();
    expect(screen.getByText('Midnight Espresso')).toBeInTheDocument();
    expect(screen.getByText('Smoked Truffle Croissant')).toBeInTheDocument();
    expect(screen.getByText(/Extra foam on latte/)).toBeInTheDocument();
  });

  it('renders action callbacks', () => {
    const onViewOrders = vi.fn();
    const onNewOrder = vi.fn();
    const { container } = render(
      <StitchOrderSuccess
        order={BASE_ORDER}
        onViewOrders={onViewOrders}
        onNewOrder={onNewOrder}
      />
    );
    expect(container.firstChild).toBeTruthy();
    expect(onViewOrders).not.toHaveBeenCalled();
    expect(onNewOrder).not.toHaveBeenCalled();
  });
});
