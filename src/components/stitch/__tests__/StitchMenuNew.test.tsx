import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import StitchMenuNew from '../StitchMenuNew';
import type { MenuItemData } from '../StitchMenuNew';
import { MENU_DRINK_IMAGES } from '@/lib/menu-drink-images';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'footer.connect': 'Connect',
        'menu.notFoundDesc': 'Not Found Desc',
        'stitch.addToCart': 'Add to Cart',
        'stitch.added': 'Added',
        'stitch.cartAriaLabel': 'Cart Aria Label',
        'stitch.clearSearchAriaLabel': 'Clear Search Aria Label',
        'stitch.favorites': 'Favorites',
        'stitch.filterAriaLabel': 'Filter Aria Label',
        'stitch.footerContact': 'Contact',
        'stitch.footerPrivacy': 'Privacy Policy',
        'stitch.footerTagline': 'Industrial Luxury Dining.',
        'stitch.footerTerms': 'Terms of Service',
        'stitch.header': 'Header',
        'stitch.menu': 'Menu',
        'stitch.menuDescription': 'Industrial precision meets high-end hospitality. Explore our curated selection of signature roasts and artisanal blends.',
        'stitch.nav': 'Nav',
        'stitch.navHome': 'Home',
        'stitch.navLocation': 'Location',
        'stitch.navMenu': 'Menu',
        'stitch.noFavoritesDesc': 'No Favorites Desc',
        'stitch.noFavoritesYet': 'No Favorites Yet',
        'stitch.noItemsInCategory': 'No Items In Category',
        'stitch.reservation': 'Reservation',
        'stitch.searchAriaLabel': 'Search Aria Label',
        'stitch.searchPlaceholder': 'Search our craft...',
        'stitch.theDigitalReserve': 'The Digital Reserve',
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
  ShoppingBag: () => null,
  Check: () => null,
  X: () => null,
  Heart: () => null,
}));

vi.mock('@/hooks/stores/use-favorites-store', () => ({
  useFavoritesStore: () => ({
    items: [],
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
  const bottledItem: MenuItemData = {
    id: 'bt002', name: 'Nước ngọt', description: '', price: '15.000₫',
    imageSrc: MENU_DRINK_IMAGES.bt002!, imageAlt: 'Nước ngọt', category: 'bottled',
  };

  it('shows Coca-Cola and Pepsi together without cropping their labels', () => {
    renderWithProviders(<StitchMenuNew items={[bottledItem]} />);
    for (const brand of [/Coca-Cola vị nguyên bản/, /Pepsi Cola/]) {
      expect(screen.getByRole('img', { name: brand })).toHaveClass('object-contain');
    }
  });

  it('uses the real gold Red Bull packshot', () => {
    renderWithProviders(<StitchMenuNew items={[{ ...bottledItem, id: 'bt003', imageSrc: MENU_DRINK_IMAGES.bt003! }]} />);
    expect(screen.getByRole('img', { name: /Red Bull lon vàng/ })).toHaveAttribute('src', '/menu/aura-drinks/red-bull.webp');
  });

  it('shows Coca-Cola Dasani bottled water without cropping or changing its price', () => {
    renderWithProviders(<StitchMenuNew items={[{
      ...bottledItem, id: 'bt001', name: 'Nước suối', price: '10.000₫', imageSrc: MENU_DRINK_IMAGES.bt001!,
    }]} />);
    const image = screen.getByRole('img', { name: /Nước đóng chai Dasani 510 ml/ });
    expect(image).toHaveAttribute('src', '/menu/aura-drinks/dasani.webp');
    expect(image).toHaveClass('object-contain');
    expect(screen.getByText('10.000₫')).toBeInTheDocument();
  });

  it('preserves custom bottled imagery', () => {
    renderWithProviders(<StitchMenuNew items={[{ ...bottledItem, imageSrc: '/uploads/soft-drinks.webp' }]} />);
    expect(screen.getByRole('img', { name: 'Nước ngọt' })).toHaveAttribute('src', '/uploads/soft-drinks.webp');
    expect(screen.queryByRole('img', { name: /Pepsi Cola/ })).toBeNull();
  });

  it('keeps the other brand visible when one packshot fails', () => {
    renderWithProviders(<StitchMenuNew items={[bottledItem]} />);
    fireEvent.error(screen.getByRole('img', { name: /Coca-Cola vị nguyên bản/ }));
    expect(screen.queryByRole('img', { name: /Coca-Cola vị nguyên bản/ })).toBeNull();
    expect(screen.getByRole('img', { name: /Pepsi Cola/ })).toBeInTheDocument();
    fireEvent.error(screen.getByRole('img', { name: /Pepsi Cola/ }));
    expect(screen.queryByRole('img', { name: /Pepsi Cola/ })).toBeNull();
    expect(screen.getByText('Đóng chai')).toBeInTheDocument();
  });

  it('renders with default items', () => {
    renderWithProviders(<StitchMenuNew />);
    expect(screen.getByText('Cà phê máy / phin truyền thống')).toBeTruthy();
  });

  it('renders with custom items', () => {
    renderWithProviders(<StitchMenuNew items={CUSTOM_ITEMS} />);
    expect(screen.getByText('Test Latte')).toBeTruthy();
    expect(screen.queryByText('Cà phê máy / phin truyền thống')).toBeNull();
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
    const cartBtn = screen.getByRole('button', { name: /Cart Aria Label/i });
    fireEvent.click(cartBtn);
    expect(onCartClick).toHaveBeenCalled();
  });

  it('filters items by search query', () => {
    renderWithProviders(<StitchMenuNew items={CUSTOM_ITEMS} />);
    const searchInput = screen.getByPlaceholderText('Search our craft...');
    fireEvent.change(searchInput, { target: { value: 'Test' } });
    expect(screen.getByText('Test Latte')).toBeTruthy();
  });

  it('matches Vietnamese drink names with or without diacritics, đ, and surrounding whitespace', () => {
    const vnItems: MenuItemData[] = [
      {
        id: 'te006',
        name: 'Trà đào',
        description: 'Trà ủ lạnh kết hợp đào miếng giòn',
        price: '30.000₫',
        imageSrc: '/menu/aura-drinks/tra-dao.webp',
        imageAlt: 'Trà đào',
        category: 'tea',
      },
      {
        id: 'jc001',
        name: 'Đá chanh',
        description: 'Chanh tươi vắt mát lạnh',
        price: '20.000₫',
        imageSrc: '/menu/aura-drinks/da-chanh.webp',
        imageAlt: 'Đá chanh',
        category: 'juice',
      },
    ];
    renderWithProviders(<StitchMenuNew items={vnItems} />);
    const searchInput = screen.getByPlaceholderText('Search our craft...');

    fireEvent.change(searchInput, { target: { value: 'tra dao' } });
    expect(screen.getByText('Trà đào')).toBeInTheDocument();
    expect(screen.queryByText('Đá chanh')).toBeNull();

    fireEvent.change(searchInput, { target: { value: '  Trà Đào  ' } });
    expect(screen.getByText('Trà đào')).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'da chanh' } });
    expect(screen.getByText('Đá chanh')).toBeInTheDocument();
    expect(screen.queryByText('Trà đào')).toBeNull();

    fireEvent.change(searchInput, { target: { value: '   ' } });
    expect(screen.getByText('Trà đào')).toBeInTheDocument();
    expect(screen.getByText('Đá chanh')).toBeInTheDocument();
  });

  it('renders brand name in nav', () => {
    renderWithProviders(<StitchMenuNew brandName="MY BRAND" />);
    const brandElements = screen.getAllByText('MY BRAND');
    expect(brandElements.length).toBeGreaterThanOrEqual(1);
  });
});
