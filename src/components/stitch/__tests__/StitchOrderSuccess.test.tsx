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
  it('renders loading skeleton when isLoading is true', () => {
    const { container } = render(<StitchOrderSuccess order={null} isLoading={true} />);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders error state with retry button', () => {
    const onRefresh = vi.fn();
    render(<StitchOrderSuccess order={null} error="Payment failed" onRefresh={onRefresh} />);
    expect(screen.getByText('Có lỗi xảy ra')).toBeInTheDocument();
    expect(screen.getByText('Payment failed')).toBeInTheDocument();
    expect(screen.getByText('Thử lại')).toBeInTheDocument();
  });

  it('renders empty state when order is null', () => {
    render(<StitchOrderSuccess order={null} />);
    expect(screen.getByText('Không tìm thấy đơn hàng')).toBeInTheDocument();
    expect(screen.getByText('Đơn hàng này không tồn tại hoặc đã bị hủy')).toBeInTheDocument();
  });

  it('renders success confirmation with order details', () => {
    render(<StitchOrderSuccess order={BASE_ORDER} />);
    expect(screen.getByText('Đặt hàng thành công!')).toBeInTheDocument();
    expect(screen.getByText('Đơn hàng đã được ghi nhận')).toBeInTheDocument();
    expect(screen.getByText('#ORD-12345')).toBeInTheDocument();
  });

  it('renders status tracker', () => {
    render(<StitchOrderSuccess order={BASE_ORDER} />);
    expect(screen.getByText('Đã nhận')).toBeInTheDocument();
    expect(screen.getByText('Đang nấu')).toBeInTheDocument();
    expect(screen.getByText('Sẵn sàng')).toBeInTheDocument();
    expect(screen.getByText('Đã phục vụ')).toBeInTheDocument();
  });

  it('renders order items and totals', () => {
    render(<StitchOrderSuccess order={BASE_ORDER} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Bàn B01')).toBeInTheDocument();
    expect(screen.getByText('Midnight Espresso')).toBeInTheDocument();
    expect(screen.getByText('Smoked Truffle Croissant')).toBeInTheDocument();
    expect(screen.getByText('Tạm tính')).toBeInTheDocument();
    expect(screen.getByText('Thuế')).toBeInTheDocument();
    expect(screen.getByText('Tổng')).toBeInTheDocument();
  });

  it('renders notes when provided', () => {
    render(<StitchOrderSuccess order={BASE_ORDER} />);
    expect(screen.getByText(/Extra foam on latte/)).toBeInTheDocument();
  });

  it('renders action buttons when callbacks provided', () => {
    const onViewOrders = vi.fn();
    const onNewOrder = vi.fn();
    render(<StitchOrderSuccess order={BASE_ORDER} onViewOrders={onViewOrders} onNewOrder={onNewOrder} />);
    expect(screen.getByText('Xem đơn hàng')).toBeInTheDocument();
    expect(screen.getByText('Đặt thêm')).toBeInTheDocument();
  });

  it('does not render action buttons when callbacks are not provided', () => {
    render(<StitchOrderSuccess order={BASE_ORDER} />);
    expect(screen.queryByText('Xem đơn hàng')).not.toBeInTheDocument();
    expect(screen.queryByText('Đặt thêm')).not.toBeInTheDocument();
  });

  it('calls onViewOrders when view orders button clicked', () => {
    const onViewOrders = vi.fn();
    render(<StitchOrderSuccess order={BASE_ORDER} onViewOrders={onViewOrders} />);
    screen.getByText('Xem đơn hàng').click();
    expect(onViewOrders).toHaveBeenCalledOnce();
  });

  it('calls onNewOrder when new order button clicked', () => {
    const onNewOrder = vi.fn();
    render(<StitchOrderSuccess order={BASE_ORDER} onNewOrder={onNewOrder} />);
    screen.getByText('Đặt thêm').click();
    expect(onNewOrder).toHaveBeenCalledOnce();
  });

  it('shows English text when locale is en', () => {
    const enOrder = { ...BASE_ORDER, notes: undefined };
    render(<StitchOrderSuccess order={enOrder} locale="en" />);
    expect(screen.getByText('Order Placed!')).toBeInTheDocument();
    expect(screen.getByText('Your order has been received')).toBeInTheDocument();
  });
});
