import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => key ?? '',
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/hooks/use-menu', () => ({
  useMenu: vi.fn(),
}));

vi.mock('@/hooks/use-checkout', () => ({
  useCheckout: vi.fn(),
  useProcessPayOS: vi.fn(),
}));

vi.mock('@/components/stitch/StitchPOSNew', () => ({
  StitchPOSNew: ({ menuItems, loading, error, brandName, onCompleteOrder }: any) => (
    <div data-testid="stitch-pos">
      {loading && <span data-testid="pos-loading">Loading menu</span>}
      {error && <span data-testid="pos-error">{error}</span>}
      <span data-testid="pos-brand">{brandName}</span>
      <span data-testid="pos-menu-count">{menuItems?.length ?? 0}</span>
      {onCompleteOrder && (
        <button data-testid="pos-checkout-btn" onClick={() => onCompleteOrder([], 0)}>
          Checkout
        </button>
      )}
    </div>
  ),
}));

vi.mock('@/config/brand-types', () => ({
  brandConfig: { brand: { nameShort: 'AURA' } },
}));

vi.mock('lucide-react', () => ({
  CheckCircle2: () => null,
  AlertCircle: () => null,
  X: () => null,
}));

import { useMenu } from '@/hooks/use-menu';
import { useCheckout, useProcessPayOS } from '@/hooks/use-checkout';
import AdminPOSPage from '@/pages/admin/POS';

const MOCK_MENU = {
  items: [
    { id: 1, name: 'Espresso', price: 35000, category: 'Coffee', image: '' },
    { id: 2, name: 'Latte', price: 45000, category: 'Coffee', image: '' },
  ],
};

function setupMocks(overrides: {
  menuData?: any;
  menuLoading?: boolean;
  menuIsError?: boolean;
  menuError?: Error | null;
  checkoutMutate?: any;
} = {}) {
  vi.mocked(useMenu).mockReturnValue({
    data: overrides.menuData ?? MOCK_MENU,
    isLoading: overrides.menuLoading ?? false,
    isError: overrides.menuIsError ?? false,
    error: overrides.menuError ?? null,
  } as any);

  vi.mocked(useCheckout).mockReturnValue({
    mutateAsync: overrides.checkoutMutate ?? vi.fn().mockResolvedValue({ success: true }),
    isPending: false,
    reset: vi.fn(),
  } as any);

  vi.mocked(useProcessPayOS).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
    reset: vi.fn(),
  } as any);
}

describe('AdminPOSPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  afterEach(() => vi.restoreAllMocks());

  it('renders without crashing', () => {
    renderWithProviders(<AdminPOSPage />);
    expect(screen.getByTestId('stitch-pos')).toBeTruthy();
  });

  it('shows loading state for menu', () => {
    setupMocks({ menuLoading: true, menuData: undefined });
    renderWithProviders(<AdminPOSPage />);
    expect(screen.getByTestId('pos-loading')).toBeTruthy();
  });

  it('maps menu items correctly', () => {
    setupMocks({ menuData: MOCK_MENU });
    renderWithProviders(<AdminPOSPage />);
    expect(screen.getByTestId('pos-menu-count').textContent).toBe('2');
  });

  it('passes brand name to POS component', () => {
    renderWithProviders(<AdminPOSPage />);
    expect(screen.getByTestId('pos-brand').textContent).toBe('AURA');
  });

  it('shows error when menu fails to load', () => {
    setupMocks({ menuIsError: true, menuError: new Error('Network error') });
    renderWithProviders(<AdminPOSPage />);
    expect(screen.getByTestId('pos-error').textContent).toBe('Network error');
  });

  it('renders checkout button from Stitch component', () => {
    renderWithProviders(<AdminPOSPage />);
    expect(screen.getByTestId('pos-checkout-btn')).toBeTruthy();
  });
});
