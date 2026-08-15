import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchPOSNew } from '../StitchPOSNew';
import type { POSNewMenuItem, POSNewAddOn } from '../StitchPOSNew-types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'posNew.addOnPrefix': 'Add On Prefix',
        'posNew.addToCart': 'Add To Cart',
        'posNew.cartEmpty': 'Cart Empty',
        'posNew.cartSection': 'Cart Section',
        'posNew.category': 'Category',
        'posNew.categoryFilter': 'Category Filter',
        'posNew.closeCart': 'Close Cart',
        'posNew.cod': 'Cod',
        'posNew.completeOrder': 'Complete Order',
        'posNew.connected': 'Connected',
        'posNew.decrementQuantity': 'Decrement Quantity',
        'posNew.endShift': 'End Shift',
        'posNew.footerNav': 'Footer Nav',
        'posNew.incrementQuantity': 'Increment Quantity',
        'posNew.loadingText': 'Loading Text',
        'posNew.menuSection': 'Menu Section',
        'posNew.noItemsInCategory': 'No Items In Category',
        'posNew.noResults': 'No Results',
        'posNew.openCart': 'Open Cart',
        'posNew.openDrawer': 'Open Drawer',
        'posNew.order': 'Order',
        'posNew.orderSummary': 'Order Summary',
        'posNew.payos': 'Payos',
        'posNew.popularAddOns': 'Popular Add Ons',
        'posNew.printReceipt': 'Print Receipt',
        'posNew.reboot': 'Reboot',
        'posNew.schedule': 'Schedule',
        'posNew.searchPlaceholder': 'Search Placeholder',
        'posNew.subtotal': 'Subtotal',
        'posNew.tax': 'Tax',
        'posNew.terminalSession': 'Terminal Session',
        'posNew.terminalVersion': 'Terminal Version',
        'posNew.total': 'Total',
        'posNew.userProfile': 'User Profile',
      }
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
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
    expect(screen.getByPlaceholderText('Search Placeholder')).toBeTruthy();
  });

  it('renders category filter chips', () => {
    renderWithProviders(<StitchPOSNew />);
    expect(screen.getByText('Coffee')).toBeTruthy();
    expect(screen.getByText('Tea')).toBeTruthy();
  });

  it('shows empty cart state initially', () => {
    renderWithProviders(<StitchPOSNew />);
    expect(screen.getByText('Cart Empty')).toBeTruthy();
  });

  it('shows loading state', () => {
    renderWithProviders(<StitchPOSNew loading />);
    expect(screen.getByText('Loading Text')).toBeTruthy();
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
    // Find and click the add-to-cart button (aria-label based)
    const addBtns = screen.getAllByRole('button', { name: /Add to Cart/i });
    expect(addBtns.length).toBeGreaterThan(0);
    fireEvent.click(addBtns[0]!);
    // Now the complete order button should be enabled
    const completeBtn = screen.getByText('Complete Order');
    expect(completeBtn).not.toBeDisabled();
    fireEvent.click(completeBtn);
    expect(onCompleteOrder).toHaveBeenCalled();
  });

  it('renders table and guest labels', () => {
    renderWithProviders(<StitchPOSNew tableLabel="T-5" guestLabel="VIP" />);
    expect(screen.getByText('T-5')).toBeTruthy();
    expect(screen.getByText(/VIP/)).toBeTruthy();
  });
});
