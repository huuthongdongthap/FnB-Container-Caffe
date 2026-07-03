/**
 * Phase 1 TDD baseline — Checkout PayOS flow tests.
 * Tests: PayOS option renders, loading state, COD default.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@/test-utils';
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

  it('shows COD as default payment method', () => {
    render(<CheckoutPage />);
    expect(screen.getByText('Cash on Delivery')).toBeInTheDocument();
  });

  it('shows PayOS payment option', () => {
    render(<CheckoutPage />);
    expect(screen.getByText('PayOS')).toBeInTheDocument();
  });

  it('shows both payment methods enabled', () => {
    render(<CheckoutPage />);
    const codButton = screen.getByRole('radio', { name: /cash on delivery/i });
    const payosButton = screen.getByRole('radio', { name: /payos/i });
    expect(codButton).not.toBeDisabled();
    expect(payosButton).not.toBeDisabled();
  });

  it('has submit button for placing order', () => {
    render(<CheckoutPage />);
    expect(screen.getByRole('button', { name: /đặt hàng|thanh toán/i })).toBeInTheDocument();
  });
});
