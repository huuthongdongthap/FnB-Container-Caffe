import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => key ?? '',
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/hooks/stores/admin/use-admin-orders-store', () => ({
  useAdminOrdersStore: vi.fn(),
}));

vi.mock('@/components/stitch', () => ({
  StitchOrderMgmtNew: ({ headerTitle, stats, orders, isLoading, error }: any) => (
    <div data-testid="stitch-order-mgmt">
      <span data-testid="header-title">{headerTitle}</span>
      {isLoading && <span data-testid="loading-indicator">Loading</span>}
      {error && <span data-testid="error-message">{error}</span>}
      <span data-testid="stats-count">{stats.length}</span>
      <span data-testid="orders-count">{orders.length}</span>
    </div>
  ),
}));

import { useAdminOrdersStore } from '@/hooks/stores/admin/use-admin-orders-store';
import AdminOrdersPage from '@/pages/admin/Orders';

const MOCK_ORDERS = [
  { id: 'o1', customer: 'Alice', status: 'pending', total: 85000, items: 2, createdAt: new Date(Date.now() - 300000).toISOString() },
  { id: 'o2', customer: 'Bob', status: 'preparing', total: 120000, items: 3, createdAt: new Date(Date.now() - 600000).toISOString() },
  { id: 'o3', customer: 'Charlie', status: 'delivered', total: 45000, items: 1, createdAt: new Date(Date.now() - 3600000).toISOString() },
];

function setupStore(overrides: {
  orders?: any[];
  loading?: boolean;
  error?: string | null;
} = {}) {
  vi.mocked(useAdminOrdersStore).mockReturnValue({
    orders: overrides.orders ?? MOCK_ORDERS,
    loading: overrides.loading ?? false,
    error: overrides.error ?? null,
    fetchOrders: vi.fn(),
    updateOrderStatus: vi.fn(),
  } as any);
}

describe('AdminOrdersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();
  });

  afterEach(() => vi.restoreAllMocks());

  it('renders without crashing', () => {
    renderWithProviders(<AdminOrdersPage />);
    expect(screen.getByTestId('stitch-order-mgmt')).toBeTruthy();
  });

  it('passes header title to Stitch component', () => {
    renderWithProviders(<AdminOrdersPage />);
    expect(screen.getByTestId('header-title').textContent).toBe('Orders');
  });

  it('shows loading state', () => {
    setupStore({ loading: true, orders: [] });
    renderWithProviders(<AdminOrdersPage />);
    expect(screen.getByTestId('loading-indicator')).toBeTruthy();
  });

  it('maps orders and shows correct count', () => {
    setupStore({ orders: MOCK_ORDERS });
    renderWithProviders(<AdminOrdersPage />);
    expect(screen.getByTestId('orders-count').textContent).toBe('3');
  });

  it('passes error to Stitch component', () => {
    setupStore({ error: 'Failed to fetch orders' });
    renderWithProviders(<AdminOrdersPage />);
    expect(screen.getByTestId('error-message').textContent).toBe('Failed to fetch orders');
  });

  it('computes stats from orders', () => {
    renderWithProviders(<AdminOrdersPage />);
    // 1 pending (active) + 1 preparing = 2 in-prep/active stats shown
    expect(screen.getByTestId('stats-count').textContent).toBe('4');
  });
});
