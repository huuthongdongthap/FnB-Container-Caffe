import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { StitchCheckoutNew } from '../StitchCheckoutNew';
import type { CheckoutNewSummary } from '../StitchCheckoutNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'stitch.confirmOrder': 'Finalize Selection',
        'stitch.customerInfo': 'Customer Information',
        'stitch.deliveryAddress': 'Delivery Address',
        'stitch.deliveryFee': 'Delivery Fee',
        'stitch.emptyCartDesc': 'Add some items to get started',
        'stitch.emptyCartTitle': 'Your cart is empty',
        'stitch.fullName': 'Full Name',
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
      };
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
    {
      id: '1',
      name: 'Espresso',
      variant: 'Single Shot',
      quantity: 2,
      price: 8,
      imageUrl: '/espresso.jpg',
    },
    {
      id: '2',
      name: 'Latte',
      variant: 'Large',
      quantity: 1,
      price: 10,
      imageUrl: '/latte.jpg',
    },
  ],
  subtotal: 18,
  tax: 2,
  deliveryFee: 1.8,
  total: 21.8,
};

describe('StitchCheckoutNew', () => {
  it('renders order summary with items', () => {
    const { container } = renderWithProviders(
      <StitchCheckoutNew summary={MOCK_SUMMARY} onPlaceOrder={vi.fn()} locale="en-US" />,
    );
    expect(screen.getByText('Espresso')).toBeTruthy();
    expect(screen.getByText('Latte')).toBeTruthy();
    expect(container.textContent).toMatch(/\$18\.00/);
  });

  it('renders order summary totals', () => {
    const { container } = renderWithProviders(
      <StitchCheckoutNew summary={MOCK_SUMMARY} onPlaceOrder={vi.fn()} locale="en-US" />,
    );
    expect(screen.getByText('Subtotal')).toBeTruthy();
    expect(screen.getByText('Luxury Tax (5%)')).toBeTruthy();
    expect(container.textContent).toMatch(/\$18\.00/);
    expect(container.textContent).toMatch(/\$2\.00/);
    expect(container.textContent).toMatch(/\$21\.80/);
  });

  it('renders place order button', () => {
    renderWithProviders(
      <StitchCheckoutNew summary={MOCK_SUMMARY} onPlaceOrder={vi.fn()} />,
    );
    expect(screen.getByText('Place Order')).toBeTruthy();
  });

  it('renders payment method section', () => {
    renderWithProviders(
      <StitchCheckoutNew summary={MOCK_SUMMARY} onPlaceOrder={vi.fn()} />,
    );
    expect(screen.getByText('Payment Method')).toBeTruthy();
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

  it('renders empty state when summary has no items', () => {
    const emptySummary: CheckoutNewSummary = {
      items: [],
      subtotal: 0,
      tax: 0,
      deliveryFee: 0,
      total: 0,
    };
    renderWithProviders(
      <StitchCheckoutNew summary={emptySummary} onPlaceOrder={vi.fn()} />,
    );
    expect(screen.getByText('Your cart is empty')).toBeTruthy();
    expect(screen.getByText('Add some items to get started')).toBeTruthy();
  });
});
