import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import StitchMenu2New from '../StitchMenu2New';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => {
      const map: Record<string, string> = {
        'stitch.menu': 'Digital Menu',
        'stitch.all': 'All',
        'stitch.coffee': 'Coffee',
        'stitch.search': 'Search...',
        'stitch.addToCart': 'Add to Cart',
        'stitch.noItems': 'No items found',
      };
      return map[key ?? ''] ?? key ?? '';
    },
  }),
}));

vi.mock('lucide-react', () => ({
  Search: () => null,
  ShoppingBag: () => null,
  Heart: () => null,
}));

vi.mock('@/hooks/stores/use-favorites-store', () => ({
  useFavoritesStore: () => ({
    favorites: [],
    toggleFavorite: vi.fn(),
    isFavorite: () => false,
  }),
}));

describe('StitchMenu2New', () => {
  it('renders the menu page', () => {
    renderWithProviders(<StitchMenu2New />);
    expect(screen.getByText('Digital Menu')).toBeTruthy();
  });

  it('renders search input', () => {
    renderWithProviders(<StitchMenu2New />);
    expect(screen.getByPlaceholderText('Search...')).toBeTruthy();
  });

  it('renders category filters', () => {
    renderWithProviders(<StitchMenu2New />);
    expect(screen.getByText('All')).toBeTruthy();
  });

  it('renders with items', () => {
    renderWithProviders(
      <StitchMenu2New
        items={[
          { id: '1', name: 'Flat White', price: '$6.00', category: 'Coffee', imageSrc: '/f.jpg', imageAlt: 'Flat White' },
        ]}
      />,
    );
    expect(screen.getByText('Flat White')).toBeTruthy();
  });

  it('shows no items message when empty items array', () => {
    renderWithProviders(<StitchMenu2New items={[]} />);
    expect(screen.getByText('No items found')).toBeTruthy();
  });
});
