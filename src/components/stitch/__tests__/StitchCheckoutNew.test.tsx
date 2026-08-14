import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchCheckoutNew } from '../StitchCheckoutNew';
import type { CheckoutNewSummary } from '../StitchCheckoutNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => {
      const map: Record<string, string> = {
        'checkout.title': 'Checkout',
        'checkout.items': 'Items',
        'checkout.subtotal': 'Subtotal',
        'checkout.tax': 'Tax',
        'checkout.deliveryFee': 'Delivery Fee',
        'checkout.total': 'Total',
        'checkout.paymentMethod': 'Payment Method',
        'checkout.payos': 'PayOS',
        'checkout.cod': 'Cash on Delivery',
        'checkout.placeOrder': 'Place Order',
        'checkout.processing': 'Processing...',
        'checkout.fullName': 'Full Name',
        'checkout.phone': 'Phone',
        'checkout.address': 'Address',
        'checkout.notes': 'Notes',
        'checkout.back': 'Back',
      };
      return map[key ?? ''] ?? key ?? '';
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
    expect(screen.getByText('Checkout')).toBeTruthy();
  });

  it('renders order items', () => {
    renderWithProviders(
      <StitchCheckoutNew summary={MOCK_SUMMARY} onPlaceOrder={vi.fn()} />,
    );
    expect(screen.getByText('Espresso')).toBeTruthy();
    expect(screen.getByText('Latte')).toBeTruthy();
  });

  it('renders order summary totals', () => {
    renderWithProviders(
      <StitchCheckoutNew summary={MOCK_SUMMARY} onPlaceOrder={vi.fn()} />,
    );
    expect(screen.getByText('18')).toBeTruthy(); // subtotal
    expect(screen.getByText('1.8')).toBeTruthy(); // tax
    expect(screen.getByText('2')).toBeTruthy(); // delivery
    expect(screen.getByText('21.8')).toBeTruthy(); // total
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
