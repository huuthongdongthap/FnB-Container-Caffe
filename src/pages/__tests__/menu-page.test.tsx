import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MenuPage } from '../menu';
import { useCartStore } from '@/hooks/stores/use-cart-store';
import type { CustomerMenu } from '@/hooks/useCustomerMenu';

const mockRefetch = vi.fn();
const mockShowToast = vi.fn();
const mockUseCustomerMenu = vi.fn();

vi.mock('@/hooks/useCustomerMenu', () => ({
  useCustomerMenu: (opts: unknown) => mockUseCustomerMenu(opts),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock('@/components/seo/HelmetHead', () => ({
  HelmetHead: () => null,
}));

vi.mock('@/components/stitch/StitchLandingNew-nav', () => ({
  LandingNav: () => <nav data-testid="landing-nav" />,
}));

vi.mock('@/components/menu/recommendation-section', () => ({
  RecommendationSection: () => <div data-testid="recommendation-section" />,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'vi-VN' },
    t: (key?: string, fallback?: string | { defaultValue?: string }) => {
      if (typeof fallback === 'string') return fallback;
      if (fallback && typeof fallback === 'object' && 'defaultValue' in fallback) {
        return fallback.defaultValue ?? key ?? '';
      }
      return key ?? '';
    },
  }),
}));

const LIVE_CATALOG: CustomerMenu = {
  totalItems: 2,
  categories: [
    {
      name: 'Cà phê truyền thống',
      items: [
        {
          id: 'tc001',
          name: 'Cà phê sữa đá',
          description: 'Đậm đà vị truyền thống',
          priceCents: 29000,
          category: 'traditional-coffee',
          imageUrl: '/menu/aura-drinks/ca-phe-sua.webp',
          available: true,
          tags: ['Iced/Hot'],
          modifierChoices: [],
        },
      ],
    },
    {
      name: 'Đóng chai',
      items: [
        {
          id: 'bt001',
          name: 'Nước suối',
          description: 'Chai 500ml',
          priceCents: 10000,
          category: 'bottled',
          imageUrl: '/menu/aura-drinks/dasani.webp',
          available: true,
          tags: ['Bottled'],
          modifierChoices: [],
        },
      ],
    },
  ],
};

function renderMenuPage(initialEntry = '/menu') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <MenuPage />
    </MemoryRouter>,
  );
}

describe('MenuPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCartStore.getState().clearCart();
  });

  it('renders an empty-catalog status with retry and does not substitute orderable sample items when catalog is empty', () => {
    mockUseCustomerMenu.mockReturnValue({
      data: {
        categories: [],
        totalItems: 0,
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    renderMenuPage();

    expect(screen.getByText('Thực đơn hiện đang cập nhật')).toBeInTheDocument();
    // Sample items from DEFAULT_ITEMS must not be rendered or orderable
    expect(screen.queryByText('Cà phê máy / phin truyền thống')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('renders an error status with retry when fetching the catalog fails', () => {
    mockUseCustomerMenu.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
      refetch: mockRefetch,
    });

    renderMenuPage();

    expect(screen.getByText('Không thể tải thực đơn lúc này')).toBeInTheDocument();
    expect(screen.queryByText('Cà phê máy / phin truyền thống')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('adds ready-to-serve bottled items directly to the cart without opening the customizer modal', () => {
    mockUseCustomerMenu.mockReturnValue({
      data: LIVE_CATALOG,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    renderMenuPage();

    const addButtons = screen.getAllByRole('button', { name: /stitch\.addToCart/i });
    // Second item is Nước suối (bt001)
    fireEvent.click(addButtons[1]!);

    expect(screen.queryByRole('dialog')).toBeNull();
    const cartItems = useCartStore.getState().items;
    expect(cartItems).toHaveLength(1);
    expect(cartItems[0]).toMatchObject({
      productId: 'bt001',
      name: 'Nước suối',
      price: 10000,
      quantity: 1,
    });
  });

  it('opens the customizer modal for craft drinks and adds the customized item to the cart on confirm', () => {
    mockUseCustomerMenu.mockReturnValue({
      data: LIVE_CATALOG,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    renderMenuPage('/menu?table=5');

    expect(screen.getByText('Bàn 5')).toBeInTheDocument();

    const addButtons = screen.getAllByRole('button', { name: /stitch\.addToCart/i });
    // First item is Cà phê sữa đá (tc001)
    fireEvent.click(addButtons[0]!);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Thêm vào giỏ/ }));

    const cartItems = useCartStore.getState().items;
    expect(cartItems).toHaveLength(1);
    expect(cartItems[0]).toMatchObject({
      productId: 'tc001',
      name: 'Cà phê sữa đá',
      price: 29000,
      quantity: 1,
    });
  });
});
