import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test-utils';
import { CheckoutForm } from '@/components/order/checkout-form';

const mockProps = {
  cartItems: [{ id: '1', name: 'Cà phê sữa đá', price: 35000, quantity: 2 }],
  subtotal: 70000,
  serviceFee: 3500,
  total: 73500,
  qualifiesForFreeDelivery: false,
  remainingForFreeDelivery: 230000,
  isSubmitting: false,
  onSubmit: vi.fn(),
};

describe('CheckoutForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates required fields on submit', async () => {
    render(<CheckoutForm {...mockProps} />);
    fireEvent.click(screen.getByText(/Đặt hàng/));
    await waitFor(() => {
      expect(screen.getByText(/họ và tên/i)).toBeInTheDocument();
    });
  });

  it('shows COD and PayOS payment options', () => {
    render(<CheckoutForm {...mockProps} />);
    expect(screen.getByText('Tiền mặt (COD)')).toBeInTheDocument();
    expect(screen.getByText('PayOS')).toBeInTheDocument();
  });

  it('selects COD by default', () => {
    render(<CheckoutForm {...mockProps} />);
    const codRadio = screen.getByRole('radio', { name: /tiền mặt/i });
    expect(codRadio).toHaveAttribute('aria-checked', 'true');
  });

  it('allows switching payment method to PayOS', () => {
    render(<CheckoutForm {...mockProps} />);
    const payosRadio = screen.getByRole('radio', { name: /payos/i });
    fireEvent.click(payosRadio);
    expect(payosRadio).toHaveAttribute('aria-checked', 'true');
  });

  it('submits form with valid data', async () => {
    const onSubmit = vi.fn();
    render(<CheckoutForm {...mockProps} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/họ và tên/i), { target: { value: 'Nguyễn Văn A' } });
    fireEvent.change(screen.getByLabelText(/số điện thoại/i), { target: { value: '0912345678' } });
    fireEvent.change(screen.getByLabelText(/địa chỉ giao hàng/i), { target: { value: '39 Nguyễn Tất Thành' } });

    fireEvent.click(screen.getByText(/Đặt hàng/));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  it('shows error for invalid phone number', async () => {
    render(<CheckoutForm {...mockProps} />);

    fireEvent.change(screen.getByLabelText(/họ và tên/i), { target: { value: 'Nguyễn Văn A' } });
    fireEvent.change(screen.getByLabelText(/số điện thoại/i), { target: { value: '123' } });
    fireEvent.change(screen.getByLabelText(/địa chỉ giao hàng/i), { target: { value: '39 Nguyễn Tất Thành' } });

    fireEvent.click(screen.getByText(/Đặt hàng/));

    await waitFor(() => {
      expect(screen.getByText(/số điện thoại không hợp lệ/i)).toBeInTheDocument();
    });
  });

  it('shows loading state when submitting', () => {
    render(<CheckoutForm {...mockProps} isSubmitting={true} />);
    const submitButton = screen.getByRole('button', { name: /đang xử lý/i });
    expect(submitButton).toBeDisabled();
  });

  it('disables form controls when submitting', () => {
    render(<CheckoutForm {...mockProps} isSubmitting={true} />);
    const inputs = screen.getAllByRole('textbox');
    inputs.forEach((input) => {
      expect(input).toBeDisabled();
    });
  });
});
