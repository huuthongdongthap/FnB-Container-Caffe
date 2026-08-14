import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import StitchMenuNew from '../StitchMenuNew';
import type { MenuItemData } from '../StitchMenuNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, opts?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'stitch.menu': 'Menu',
        'stitch.searchPlaceholder': opts?.defaultValue as string ?? 'Search our craft...',
        'stitch.addToCart': opts?.defaultValue as string ?? 'Add to Cart',
        'stitch.viewCart': 'View Cart',
        'stitch.all': 'All',
        'stitch.coffee': 'Coffee',
        'stitch.signature': 'Signature',
        'stitch.brandName': opts?.defaultValue as string ?? 'AURA CAFE',
      };
      return map[key ?? ''] ?? key ?? '';
    },
  }),
}));

vi.mock('lucide-react', () => ({
  Search: () => null,
  ShoppingBag: () => null,
  Check: () => null,
  X: () => null,
  Heart: () => null,
}));

vi.mock('@/hooks/stores/use-favorites-store', () => ({
  useFavoritesStore: () => ({
    favorites: [],
    toggleFavorite: vi.fn(),
    isFavorite: () => false,
  }),
}));

const CUSTOM_ITEMS: MenuItemData[] = [
  {
    id: 'm1',
    name: 'Test Latte',
    description: 'A test latte.',
    price: '$5.00',
    imageSrc: '/latte.jpg',
    imageAlt: 'Latte',
    category: 'coffee',
  },
];

describe('StitchMenuNew', () => {
  it('renders with default items', () => {
    renderWithProviders(<StitchMenuNew />);
    expect(screen.getByText('Midnight Espresso')).toBeTruthy();
  });

  it('renders with custom items', () => {
    renderWithProviders(<StitchMenuNew items={CUSTOM_ITEMS} />);
    expect(screen.getByText('Test Latte')).toBeTruthy();
    expect(screen.queryByText('Midnight Espresso')).toBeNull();
  });

  it('renders search input', () => {
    renderWithProviders(<StitchMenuNew />);
    expect(screen.getByPlaceholderText('Search our craft...')).toBeTruthy();
  });

  it('calls onAddToCart when add button is clicked', () => {
    const onAddToCart = vi.fn();
    renderWithProviders(<StitchMenuNew items={CUSTOM_ITEMS} onAddToCart={onAddToCart} />);
    const addBtn = screen.getByText('Add to Cart');
    fireEvent.click(addBtn);
    expect(onAddToCart).toHaveBeenCalledWith(CUSTOM_ITEMS[0]);
  });

  it('shows cart item count', () => {
    renderWithProviders(<StitchMenuNew cartItemCount={3} />);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('calls onCartClick when cart FAB is clicked', () => {
    const onCartClick = vi.fn();
    renderWithProviders(<StitchMenuNew onCartClick={onCartClick} cartItemCount={2} />);
    const cartBtn = screen.getByRole('button', { name: /stitch.cartAriaLabel/i });
    fireEvent.click(cartBtn);
    expect(onCartClick).toHaveBeenCalled();
  });

  it('filters items by search query', () => {
    renderWithProviders(<StitchMenuNew items={CUSTOM_ITEMS} />);
    const searchInput = screen.getByPlaceholderText('Search our craft...');
    fireEvent.change(searchInput, { target: { value: 'Test' } });
    expect(screen.getByText('Test Latte')).toBeTruthy();
  });

  it('renders brand name in nav', () => {
    renderWithProviders(<StitchMenuNew brandName="MY BRAND" />);
    const brandElements = screen.getAllByText('MY BRAND');
    expect(brandElements.length).toBeGreaterThanOrEqual(1);
  });
});
