import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor } from '@/test-utils';

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

vi.mock('@/hooks/use-offline-sync', () => ({
  useOfflineSync: vi.fn(),
}));

vi.mock('@/components/stitch/StitchPOSNew', () => ({
  StitchPOSNew: ({
    menuItems,
    loading,
    error,
    brandName,
    onCompleteOrder,
    orderType,
    onOrderTypeChange,
    onPayment,
    onDeliveryAddressChange,
    onDeliveryRecipientNameChange,
    onDeliveryRecipientPhoneChange,
  }: any) => (
    <div data-testid="stitch-pos" data-order-type={orderType}>
      {loading && <span data-testid="pos-loading">Loading menu</span>}
      {error && <span data-testid="pos-error">{error}</span>}
      <span data-testid="pos-brand">{brandName}</span>
      <span data-testid="pos-menu-count">{menuItems?.length ?? 0}</span>
      {onOrderTypeChange && (
        <button data-testid="pos-switch-delivery" onClick={() => onOrderTypeChange('delivery')}>
          Switch Delivery
        </button>
      )}
      {onPayment && (
        <button data-testid="pos-select-cod" onClick={() => onPayment('cod')}>
          Select COD
        </button>
      )}
      {onDeliveryAddressChange && (
        <input
          data-testid="pos-delivery-address-input"
          onChange={(e) => onDeliveryAddressChange(e.target.value)}
        />
      )}
      {onDeliveryRecipientNameChange && (
        <input
          data-testid="pos-delivery-recipient-name"
          onChange={(e) => onDeliveryRecipientNameChange(e.target.value)}
        />
      )}
      {onDeliveryRecipientPhoneChange && (
        <input
          data-testid="pos-delivery-recipient-phone"
          onChange={(e) => onDeliveryRecipientPhoneChange(e.target.value)}
        />
      )}
      {onCompleteOrder && (
        <button
          data-testid="pos-checkout-btn"
          onClick={() => onCompleteOrder([{ id: '1', name: 'Espresso', price: 35000, quantity: 1 }], 35000)}
        >
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
  ExternalLink: () => null,
  RefreshCw: () => null,
  Banknote: () => null,
}));

import { useMenu } from '@/hooks/use-menu';
import { useCheckout, useProcessPayOS } from '@/hooks/use-checkout';
import { useOfflineSync } from '@/hooks/use-offline-sync';
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

  vi.mocked(useOfflineSync).mockReturnValue({
    isOnline: true,
    pendingCount: 0,
    quarantinedCount: 0,
    syncing: false,
    lastSyncAt: null,
    error: null,
    syncAll: vi.fn(),
    refreshPendingCount: vi.fn(),
    enqueueOrder: vi.fn(),
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

  it('surfaces quarantined offline orders banner when quarantinedCount > 0', () => {
    vi.mocked(useOfflineSync).mockReturnValue({
      isOnline: true,
      pendingCount: 0,
      quarantinedCount: 3,
      syncing: false,
      lastSyncAt: null,
      error: null,
      syncAll: vi.fn(),
      refreshPendingCount: vi.fn(),
      enqueueOrder: vi.fn(),
    } as any);
    renderWithProviders(<AdminPOSPage />);
    expect(screen.getByTestId('pos-quarantined-banner')).toBeTruthy();
  });

  it('delegates channel switcher state to StitchPOSNew without a fixed bottom-left overlay', () => {
    const { container } = renderWithProviders(<AdminPOSPage />);
    const pos = screen.getByTestId('stitch-pos');
    expect(pos.getAttribute('data-order-type')).toBe('takeaway');
    expect(container.querySelector('.fixed.bottom-4.left-4')).toBeNull();

    fireEvent.click(screen.getByTestId('pos-switch-delivery'));
    expect(pos.getAttribute('data-order-type')).toBe('delivery');
  });

  it('#212: blocks delivery order without recipient name/phone and preserves recipient entered after address (no stale closure)', async () => {
    const checkoutMutate = vi.fn().mockResolvedValue({
      success: true,
      order_id: 'ORD_DELIV_1',
      payment_url: 'https://pay.payos.vn/web/test',
      order: { id: 'ORD_DELIV_1', total: 50000, payment_status: 'unpaid' },
    });
    setupMocks({ checkoutMutate });
    renderWithProviders(<AdminPOSPage />);

    fireEvent.click(screen.getByTestId('pos-switch-delivery'));
    fireEvent.change(screen.getByTestId('pos-delivery-address-input'), {
      target: { value: '37 Luu Van Lang, Sa Dec' },
    });

    // Missing recipient name -> blocked before API call
    fireEvent.click(screen.getByTestId('pos-checkout-btn'));
    expect(checkoutMutate).not.toHaveBeenCalled();

    // Now type recipient name & valid phone AFTER address (regression for stale closure)
    fireEvent.change(screen.getByTestId('pos-delivery-recipient-name'), {
      target: { value: 'Nguyen Thi Lan' },
    });
    fireEvent.change(screen.getByTestId('pos-delivery-recipient-phone'), {
      target: { value: '0901234567' },
    });

    fireEvent.click(screen.getByTestId('pos-checkout-btn'));
    await waitFor(() => {
      expect(checkoutMutate).toHaveBeenCalledTimes(1);
    });
    expect(checkoutMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        order_type: 'delivery',
        customer_name: 'Nguyen Thi Lan',
        customer_phone: '0901234567',
        customer_address: '37 Luu Van Lang, Sa Dec',
      }),
    );
  });

  it('#212: uses channel-appropriate guest name "Khách mang đi" for walk-in takeaway orders', async () => {
    const checkoutMutate = vi.fn().mockResolvedValue({
      success: true,
      order_id: 'ORD_TK_1',
      order: { id: 'ORD_TK_1', total: 35000, payment_status: 'unpaid' },
    });
    setupMocks({ checkoutMutate });
    renderWithProviders(<AdminPOSPage />);

    fireEvent.click(screen.getByTestId('pos-select-cod'));
    fireEvent.click(screen.getByTestId('pos-checkout-btn'));
    await waitFor(() => {
      expect(checkoutMutate).toHaveBeenCalledTimes(1);
    });
    expect(checkoutMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        order_type: 'takeaway',
        customer_name: 'Khách mang đi',
      }),
    );
  });
});
