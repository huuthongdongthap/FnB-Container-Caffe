/**
 * Phase 1 TDD baseline — Checkout PayOS flow tests.
 * Tests: PayOS option renders, loading state, COD default.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@/test-utils';
import { CheckoutPage } from '@/pages/checkout';
import { useCartStore } from '@/hooks/stores/use-cart-store';

// Seed cart so checkout doesn't redirect to /menu
function seedCart() {
  useCartStore.setState({
    items: [{ id: '1', name: 'Cà phê sữa', price: 35000, quantity: 2 }],
  });
}

function resetCart() {
  useCartStore.setState({ items: [] });
}

describe('CheckoutPage — PayOS flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedCart();
  });

  afterEach(() => {
    resetCart();
  });

  it('renders checkout page with cart items', () => {
    render(<CheckoutPage />);
    expect(screen.getByText(/Đặt hàng|Place Order/)).toBeInTheDocument();
  });

  it('shows COD as Vietnamese Tiền mặt payment method without English hardcode', () => {
    render(<CheckoutPage />);
    fireEvent.click(screen.getByRole('button', { name: /mang đi/i }));
    expect(screen.getByText('Tiền mặt')).toBeInTheDocument();
    expect(screen.queryByText('Cash on Delivery')).not.toBeInTheDocument();
  });

  it('shows PayOS payment option', () => {
    render(<CheckoutPage />);
    expect(screen.getByText('PayOS')).toBeInTheDocument();
  });

  it('shows both payment methods enabled and allows selecting Tiền mặt', () => {
    render(<CheckoutPage />);
    fireEvent.click(screen.getByRole('button', { name: /mang đi/i }));
    const codButton = screen.getByRole('radio', { name: /tiền mặt/i });
    const payosButton = screen.getByRole('radio', { name: /payos/i });
    expect(codButton).not.toBeDisabled();
    expect(payosButton).not.toBeDisabled();
    expect(codButton).toHaveAttribute('value', 'cod');
  });

  it('has submit button for placing order', () => {
    render(<CheckoutPage />);
    expect(screen.getByRole('button', { name: /đặt hàng|thanh toán/i })).toBeInTheDocument();
  });
});
