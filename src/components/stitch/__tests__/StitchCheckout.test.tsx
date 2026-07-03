import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test-utils';
import StitchCheckout from '@/components/stitch/StitchCheckout';
import type { OrderSummaryData } from '@/components/stitch/StitchCheckout';

const BASE_SUMMARY: OrderSummaryData = {
  items: [
    { id: '1', name: 'Midnight Espresso', variant: 'Hot', quantity: 2, price: 6.50, imageUrl: 'https://example.com/coffee.jpg' },
    { id: '2', name: 'Smoked Truffle Croissant', variant: 'Regular', quantity: 1, price: 9.00, imageUrl: 'https://example.com/croissant.jpg' },
  ],
  subtotal: 22.00,
  tax: 1.10,
  deliveryFee: 3.00,
  total: 26.10,
};

describe('StitchCheckout', () => {
  it('renders loading skeleton when summary is null', () => {
    const { container } = render(<StitchCheckout summary={null} onPlaceOrder={vi.fn()} />);
    expect(screen.getByLabelText('Loading checkout')).toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders empty state when cart has no items', () => {
    render(<StitchCheckout summary={{ ...BASE_SUMMARY, items: [] }} onPlaceOrder={vi.fn()} />);
    expect(screen.getByText('Giỏ hàng trống')).toBeInTheDocument();
    expect(screen.getByText('Thêm món vào giỏ hàng để tiếp tục')).toBeInTheDocument();
  });

  it('renders error message from props', () => {
    render(<StitchCheckout summary={BASE_SUMMARY} error="Network error" onPlaceOrder={vi.fn()} />);
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('renders checkout form with customer fields and order summary', () => {
    render(<StitchCheckout summary={BASE_SUMMARY} onPlaceOrder={vi.fn()} />);
    expect(screen.getByText('Xác nhận đơn hàng')).toBeInTheDocument();
    expect(screen.getByText('Thông tin khách hàng')).toBeInTheDocument();
    expect(screen.getByText('Phương thức thanh toán')).toBeInTheDocument();
    expect(screen.getByText('Tóm tắt đơn hàng')).toBeInTheDocument();
    expect(screen.getByText('Midnight Espresso')).toBeInTheDocument();
    expect(screen.getByText('Smoked Truffle Croissant')).toBeInTheDocument();
  });

  it('shows processing state and disables submit button', () => {
    render(<StitchCheckout summary={BASE_SUMMARY} isProcessing={true} onPlaceOrder={vi.fn()} />);
    expect(screen.getByText('Đang xử lý...')).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /đang xử lý/i });
    expect(btn).toBeDisabled();
  });

  it('shows submit error on failed order', async () => {
    const failingFn = vi.fn().mockRejectedValue(new Error('Payment declined'));
    render(<StitchCheckout summary={BASE_SUMMARY} onPlaceOrder={failingFn} />);
    const submitBtn = screen.getByRole('button', { name: /đặt hàng/i });
    fireEvent.click(submitBtn);
    expect(await screen.findByText('Payment declined')).toBeInTheDocument();
  });

  it('renders items count and total price in summary bar', () => {
    render(<StitchCheckout summary={BASE_SUMMARY} onPlaceOrder={vi.fn()} />);
    expect(screen.getByText('2 món')).toBeInTheDocument();
    expect(screen.getByText('Tổng tiền')).toBeInTheDocument();
  });

  it('renders English locale text when locale is en', () => {
    render(<StitchCheckout summary={BASE_SUMMARY} onPlaceOrder={vi.fn()} locale="en" />);
    expect(screen.getByText('Finalize Selection')).toBeInTheDocument();
    expect(screen.getByText('Customer Information')).toBeInTheDocument();
    expect(screen.getByText('Payment Method')).toBeInTheDocument();
  });

  it('calls onPlaceOrder with form data on submit', async () => {
    const onPlaceOrder = vi.fn().mockResolvedValue(undefined);
    render(<StitchCheckout summary={BASE_SUMMARY} onPlaceOrder={onPlaceOrder} />);

    fireEvent.change(screen.getByLabelText(/họ và tên/i), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText(/số điện thoại/i), { target: { value: '0912345678' } });
    fireEvent.change(screen.getByLabelText(/địa chỉ giao hàng/i), { target: { value: '123 Main St' } });
    fireEvent.click(screen.getByRole('button', { name: /đặt hàng/i }));

    expect(await screen.findByText('Đang xử lý...')).toBeInTheDocument();
    expect(onPlaceOrder).toHaveBeenCalledWith(expect.objectContaining({
      fullName: 'John Doe',
      phone: '0912345678',
      address: '123 Main St',
    }));
  });
});
