import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchCheckoutNew } from '../StitchCheckoutNew';
import type { CheckoutNewSummary } from '../StitchCheckoutNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'stitch.account': 'Account',
        'stitch.cart': 'Cart',
        'stitch.confirmOrder': 'Finalize Selection',
        'stitch.customerInfo': 'Customer Information',
        'stitch.deliveryAddress': 'Delivery Address',
        'stitch.deliveryFee': 'Delivery Fee',
        'stitch.emptyCartDesc': 'Add some items to get started',
        'stitch.emptyCartTitle': 'Your cart is empty',
        'stitch.fullName': 'Full Name',
        'stitch.items': 'Nocturnal Crafts',
        'stitch.orderFailed': 'Order failed',
        'stitch.orderNotes': 'Order Notes',
        'stitch.orderSummary': 'Order Summary',
        'stitch.paymentMethod': 'Payment Method',
        'stitch.phone': 'Phone Number',
        'stitch.placeOrder': 'Place Order',
        'stitch.processing': 'Processing...',
        'stitch.selectedItems': 'Selected Items',
        'stitch.subtotal': 'Subtotal',
        'stitch.tax': 'Luxury Tax (5%)',
        'stitch.totalAmount': 'Total Amount',
      }
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
    },
  }),
}));

vi.mock('lucide-react', () => ({
  ShoppingBag: () => null,
  CircleUser: () => null,
  User: () => null,
  Wallet: () => null,
  Banknote: () => null,
  Package: () => null,
  AlertTriangle: () => null,
  RefreshCw: () => null,
}));

const MOCK_SUMMARY: CheckoutNewSummary = {
  items: [
    { id: '1', name: 'Espresso', variant: 'Single', quantity: 2, price: 5.5, imageUrl: '/e.jpg' },
    { id: '2', name: 'Latte', variant: 'Large', quantity: 1, price: 7.0, imageUrl: '/l.jpg' },
  ],
  subtotal: 18.0,
  tax: 1.8,
  taxLabel: 'VAT',
  deliveryFee: 2.0,
  deliveryLabel: 'Shipping',
  total: 21.8,
};

describe('StitchCheckoutNew', () => {
  it('renders checkout title', () => {
    renderWithProviders(
      <StitchCheckoutNew summary={MOCK_SUMMARY} onPlaceOrder={vi.fn()} />,
    );
    expect(screen.getByText('Finalize Selection')).toBeTruthy();
  });

  it('renders order items', () => {
    renderWithProviders(
      <StitchCheckoutNew summary={MOCK_SUMMARY} onPlaceOrder={vi.fn()} />,
    );
    expect(screen.getByText('Espresso')).toBeTruthy();
    expect(screen.getByText('Latte')).toBeTruthy();
  });

  it('renders order summary totals', () => {
    const { container } = renderWithProviders(
      <StitchCheckoutNew summary={MOCK_SUMMARY} onPlaceOrder={vi.fn()} />,
    );
    // Format: currency formatted values (e.g. "$18.00")
    expect(container.textContent).toMatch(/\$18\.00/);
    expect(container.textContent).toMatch(/\$2\.00/);
    expect(container.textContent).toMatch(/\$21\.80/);
  });

  it('renders payment method options', () => {
    renderWithProviders(
      <StitchCheckoutNew summary={MOCK_SUMMARY} onPlaceOrder={vi.fn()} />,
    );
    expect(screen.getByText('PayOS')).toBeTruthy();
    expect(screen.getByText('Cash on Delivery')).toBeTruthy();
  });

  it('calls onPlaceOrder when place order button is clicked', async () => {
    const onPlaceOrder = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <StitchCheckoutNew summary={MOCK_SUMMARY} onPlaceOrder={onPlaceOrder} />,
    );
    const placeOrderBtn = screen.getByText('Place Order');
    fireEvent.click(placeOrderBtn);
    expect(onPlaceOrder).toHaveBeenCalled();
  });

  it('shows processing state when isProcessing is true', () => {
    renderWithProviders(
      <StitchCheckoutNew summary={MOCK_SUMMARY} onPlaceOrder={vi.fn()} isProcessing />,
    );
    expect(screen.getByText('Processing...')).toBeTruthy();
  });

  it('shows error message when error is provided', () => {
    renderWithProviders(
      <StitchCheckoutNew summary={MOCK_SUMMARY} onPlaceOrder={vi.fn()} error="Payment failed" />,
    );
    expect(screen.getByText('Payment failed')).toBeTruthy();
  });

  it('renders empty state when summary is null', () => {
    renderWithProviders(
      <StitchCheckoutNew summary={null} onPlaceOrder={vi.fn()} />,
    );
    expect(screen.getByText('Your cart is empty')).toBeTruthy();
    expect(screen.getByText('Add some items to get started')).toBeTruthy();
  });
});
