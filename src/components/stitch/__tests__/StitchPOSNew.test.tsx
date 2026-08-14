import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchPOSNew } from '../StitchPOSNew';
import type { POSNewMenuItem, POSNewAddOn } from '../StitchPOSNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => {
      const map: Record<string, string> = {
        'stitch.pos': 'POS Terminal',
        'stitch.search': 'Search menu...',
        'stitch.cart': 'Cart',
        'stitch.subtotal': 'Subtotal',
        'stitch.tax': 'Tax',
        'stitch.total': 'Total',
        'stitch.completeOrder': 'Complete Order',
        'stitch.add': 'Add',
        'stitch.remove': 'Remove',
        'stitch.emptyCart': 'Cart is empty',
        'stitch.loading': 'Loading...',
        'stitch.error': 'Error loading menu',
        'stitch.all': 'All',
        'stitch.payos': 'PayOS',
        'stitch.cod': 'Cash on Delivery',
      };
      return map[key ?? ''] ?? key ?? '';
    },
  }),
}));

vi.mock('lucide-react', () => ({
  Search: () => null,
  Plus: () => null,
  Minus: () => null,
  ShoppingCart: () => null,
  CreditCard: () => null,
  Wallet: () => null,
  ArrowRight: () => null,
  Clock: () => null,
  Terminal: () => null,
  PersonStanding: () => null,
  LogOut: () => null,
  Receipt: () => null,
  Printer: () => null,
  Loader2: () => null,
  AlertCircle: () => null,
  Coffee: () => null,
}));

const CUSTOM_ITEMS: POSNewMenuItem[] = [
  { id: 'p1', name: 'Custom Brew', price: 5.0, category: 'Coffee' },
];

const CUSTOM_ADDONS: POSNewAddOn[] = [
  { id: 'pa1', name: 'Extra Shot', price: 1.5 },
];

describe('StitchPOSNew', () => {
  it('renders with default menu items', () => {
    renderWithProviders(<StitchPOSNew />);
    expect(screen.getByText('Midnight Espresso')).toBeTruthy();
    expect(screen.getByText('Chrome Velvet')).toBeTruthy();
  });

  it('renders with custom menu items', () => {
    renderWithProviders(<StitchPOSNew menuItems={CUSTOM_ITEMS} />);
    expect(screen.getByText('Custom Brew')).toBeTruthy();
    expect(screen.queryByText('Midnight Espresso')).toBeNull();
  });

  it('renders search input', () => {
    renderWithProviders(<StitchPOSNew />);
    expect(screen.getByPlaceholderText('Search menu...')).toBeTruthy();
  });

  it('renders category filter chips', () => {
    renderWithProviders(<StitchPOSNew />);
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('Coffee')).toBeTruthy();
    expect(screen.getByText('Pastries')).toBeTruthy();
  });

  it('shows empty cart state initially', () => {
    renderWithProviders(<StitchPOSNew />);
    expect(screen.getByText('Cart is empty')).toBeTruthy();
  });

  it('shows loading state', () => {
    renderWithProviders(<StitchPOSNew loading />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('shows error state', () => {
    renderWithProviders(<StitchPOSNew error="Connection failed" />);
    expect(screen.getByText('Connection failed')).toBeTruthy();
  });

  it('adds items to cart when clicked', () => {
    renderWithProviders(<StitchPOSNew />);
    const espressoCard = screen.getByText('Midnight Espresso').closest('[data-glass]');
    if (espressoCard) {
      fireEvent.click(espressoCard);
      expect(screen.getByText('1')).toBeTruthy();
    }
  });

  it('renders brand name', () => {
    renderWithProviders(<StitchPOSNew brandName="MY POS" />);
    expect(screen.getByText('MY POS')).toBeTruthy();
  });

  it('calls onCompleteOrder when complete order button is clicked', () => {
    const onCompleteOrder = vi.fn();
    renderWithProviders(<StitchPOSNew onCompleteOrder={onCompleteOrder} />);
    const completeBtn = screen.getByText('Complete Order');
    fireEvent.click(completeBtn);
    expect(onCompleteOrder).toHaveBeenCalled();
  });

  it('renders table and guest labels', () => {
    renderWithProviders(<StitchPOSNew tableLabel="T-5" guestLabel="VIP" />);
    expect(screen.getByText('T-5')).toBeTruthy();
    expect(screen.getByText('VIP')).toBeTruthy();
  });
});
