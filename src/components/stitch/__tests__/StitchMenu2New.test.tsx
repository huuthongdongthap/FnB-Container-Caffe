import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import StitchMenu2New from '../StitchMenu2New';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'stitch.menu2.addToOrder': 'Add To Order',
        'stitch.menu2.added': 'Added',
        'stitch.menu2.allRightsReserved': 'All Rights Reserved',
        'stitch.menu2.brewTempLabel': 'Brew Temp Label',
        'stitch.menu2.brewTempValue': 'Brew Temp Value',
        'stitch.menu2.cartAriaLabel': 'Cart Aria Label',
        'stitch.menu2.craftDescription': 'Craft Description',
        'stitch.menu2.craftHeading': 'Craft Heading',
        'stitch.menu2.craftSectionAriaLabel': 'Craft Section Aria Label',
        'stitch.menu2.craftSubtitle': 'Craft Subtitle',
        'stitch.menu2.emptyMenu': 'Empty Menu',
        'stitch.menu2.filterAriaLabel': 'Filter Aria Label',
        'stitch.menu2.filterMicron': 'Filter Micron',
        'stitch.menu2.footerAriaLabel': 'Footer Aria Label',
        'stitch.menu2.footerInstagram': 'Footer Instagram',
        'stitch.menu2.footerLinksLabel': 'Footer Links Label',
        'stitch.menu2.footerPrivacy': 'Footer Privacy',
        'stitch.menu2.footerTerms': 'Footer Terms',
        'stitch.menu2.heroAriaLabel': 'Hero Aria Label',
        'stitch.menu2.heroSubtitle': 'Hero Subtitle',
        'stitch.menu2.heroTitle': 'Hero Title',
        'stitch.menu2.micronFilter': 'Micron Filter',
        'stitch.menu2.navAriaLabel': 'Nav Aria Label',
        'stitch.menu2.navHome': 'Nav Home',
        'stitch.menu2.navLabel': 'Nav Label',
        'stitch.menu2.navLocation': 'Nav Location',
        'stitch.menu2.navMenu': 'Nav Menu',
        'stitch.menu2.noItemsInCategory': 'No Items In Category',
        'stitch.menu2.pageLabel': 'Page Label',
        'stitch.menu2.reservation': 'Reservation',
        'stitch.menu2.reservationAriaLabel': 'Reservation Aria Label',
        'stitch.menu2.searchAriaLabel': 'Search Aria Label',
        'stitch.menu2.searchPlaceholder': 'Search Placeholder',
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
