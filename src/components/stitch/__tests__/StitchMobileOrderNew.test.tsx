import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchMobileOrderNew } from '../StitchMobileOrderNew';
import type { MenuItem } from '../StitchMobileOrderNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => {
      const map: Record<string, string> = {
        'stitch.mobileOrder': 'Mobile Order',
        'stitch.back': 'Back',
        'stitch.search': 'Search',
        'stitch.addToCart': 'Add to Cart',
        'stitch.viewCart': 'View Cart',
        'stitch.loading': 'Loading...',
        'stitch.error': 'Something went wrong',
        'stitch.empty': 'No items available',
        'stitch.cart': 'Cart',
        'stitch.quantity': 'Quantity',
        'stitch.signature': 'Signature',
      };
      return map[key ?? ''] ?? key ?? '';
    },
  }),
}));

vi.mock('lucide-react', () => ({
  Search: () => null,
  ShoppingCart: () => null,
  Plus: () => null,
  Minus: () => null,
  ArrowLeft: () => null,
  Coffee: () => null,
  ChevronRight: () => null,
  Star: () => null,
}));

const CUSTOM_ITEMS: MenuItem[] = [
  {
    id: 'c1',
    name: 'Custom Espresso',
    description: 'A custom test espresso.',
    price: 4.0,
    priceLabel: '$4.00',
    category: 'coffee',
    imageSrc: '/img.jpg',
    imageAlt: 'Espresso',
  },
];

describe('StitchMobileOrderNew', () => {
  it('renders with default items', () => {
    renderWithProviders(<StitchMobileOrderNew />);
    expect(screen.getByText('Midnight Espresso')).toBeTruthy();
    expect(screen.getByText('Chrome Velvet Latte')).toBeTruthy();
  });

  it('renders with custom items', () => {
    renderWithProviders(<StitchMobileOrderNew items={CUSTOM_ITEMS} />);
    expect(screen.getByText('Custom Espresso')).toBeTruthy();
    expect(screen.queryByText('Midnight Espresso')).toBeNull();
  });

  it('shows loading state', () => {
    renderWithProviders(<StitchMobileOrderNew loading />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('shows error state', () => {
    renderWithProviders(<StitchMobileOrderNew error="Network error" />);
    expect(screen.getByText('Network error')).toBeTruthy();
  });

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn();
    renderWithProviders(<StitchMobileOrderNew onBack={onBack} />);
    const backBtn = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalled();
  });

  it('adds items to cart when add button is clicked', () => {
    renderWithProviders(<StitchMobileOrderNew />);
    const addButtons = screen.getAllByRole('button', { name: /add/i });
    expect(addButtons.length).toBeGreaterThan(0);
    fireEvent.click(addButtons[0]);
    // Cart count should increment
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('renders category filter chips', () => {
    renderWithProviders(<StitchMobileOrderNew />);
    expect(screen.getByText(/all/i)).toBeTruthy();
    expect(screen.getByText(/coffee/i)).toBeTruthy();
  });

  it('calls onViewCart when view cart is clicked', () => {
    const onViewCart = vi.fn();
    renderWithProviders(<StitchMobileOrderNew onViewCart={onViewCart} />);
    const viewCartBtn = screen.getByText('View Cart');
    fireEvent.click(viewCartBtn);
    expect(onViewCart).toHaveBeenCalled();
  });
});
