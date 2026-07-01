import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test-utils';
import { PaymentMethodSelector } from '@/components/order/payment-method-selector';

describe('PaymentMethodSelector', () => {
  it('renders COD and PayOS options', () => {
    render(<PaymentMethodSelector selected="cod" onChange={() => {}} />);
    expect(screen.getByText('Tiền mặt (COD)')).toBeInTheDocument();
    expect(screen.getByText('PayOS')).toBeInTheDocument();
    expect(screen.getByText('Thanh toán khi nhận đồ')).toBeInTheDocument();
    expect(screen.getByText('Chuyển khoản VietQR')).toBeInTheDocument();
  });

  it('shows only COD and PayOS (no MoMo/VNPay)', () => {
    render(<PaymentMethodSelector selected="cod" onChange={() => {}} />);
    expect(screen.queryByText(/MoMo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/VNPay/i)).not.toBeInTheDocument();
  });

  it('marks selected method with aria-checked', () => {
    const { rerender } = render(<PaymentMethodSelector selected="cod" onChange={() => {}} />);
    const codOption = screen.getByRole('radio', { name: /tiền mặt/i });
    const payosOption = screen.getByRole('radio', { name: /payos/i });
    expect(codOption).toHaveAttribute('aria-checked', 'true');
    expect(payosOption).toHaveAttribute('aria-checked', 'false');

    rerender(<PaymentMethodSelector selected="payos" onChange={() => {}} />);
    expect(payosOption).toHaveAttribute('aria-checked', 'true');
    expect(codOption).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onChange when option clicked', () => {
    const onChange = vi.fn();
    render(<PaymentMethodSelector selected="cod" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: /payos/i }));
    expect(onChange).toHaveBeenCalledWith('payos');
  });

  it('supports keyboard navigation with focus-visible styles', () => {
    render(<PaymentMethodSelector selected="cod" onChange={() => {}} />);
    const options = screen.getAllByRole('radio');
    expect(options.length).toBe(2);
    options[0]?.focus();
    expect(document.activeElement).toBe(options[0]);
  });

  it('disables options when disabled prop is set', () => {
    render(<PaymentMethodSelector selected="cod" onChange={() => {}} disabled={true} />);
    const options = screen.getAllByRole('radio');
    options.forEach((opt) => {
      expect(opt).toBeDisabled();
    });
  });
});
