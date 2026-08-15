import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => key ?? '',
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/seo/HelmetHead', () => ({
  HelmetHead: () => null,
}));

vi.mock('@/hooks/stores/admin/use-admin-dashboard-store', () => ({
  useAdminDashboardStore: vi.fn(),
}));

vi.mock('@/hooks/stores/admin/use-admin-orders-store', () => ({
  useAdminOrdersStore: vi.fn(),
}));

vi.mock('@/hooks/use-admin', () => ({
  useAdmin: vi.fn(),
}));

vi.mock('@/hooks/use-analytics-data', () => ({
  useTopProducts: vi.fn(() => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() })),
  usePeakHours: vi.fn(() => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() })),
  useCustomerMetrics: vi.fn(() => ({ data: null, isLoading: false, isError: false, error: null, refetch: vi.fn() })),
  useDailyRevenue: vi.fn(() => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() })),
  useZoneStats: vi.fn(() => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() })),
  downloadAnalyticsCsv: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/components/admin/StatsCard', () => ({
  StatsCard: ({ title, value }: any) => (
    <div data-testid="stats-card">
      <span>{title}</span>
      <span>{String(value)}</span>
    </div>
  ),
}));

vi.mock('@/components/admin/StuckPaymentsCard', () => ({
  StuckPaymentsCard: () => <div data-testid="stuck-payments-card" />,
}));

vi.mock('@/components/admin/OrderTable', () => ({
  OrderTable: ({ orders }: any) => <div data-testid="order-table">{orders.length}</div>,
}));

vi.mock('@/components/admin/CustomerTable', () => ({
  CustomerTable: ({ customers }: any) => <div data-testid="customer-table">{customers.length}</div>,
}));

vi.mock('@/components/admin/CustomerMetrics', () => ({
  CustomerMetrics: ({ loading }: any) => <div data-testid="customer-metrics">{loading ? 'loading' : 'loaded'}</div>,
}));

vi.mock('@/components/admin/RevenueChart', () => ({
  RevenueChart: ({ loading }: any) => <div data-testid="revenue-chart">{loading ? 'loading' : 'loaded'}</div>,
}));

vi.mock('@/components/admin/TopProductsChart', () => ({
  TopProductsChart: ({ loading }: any) => <div data-testid="top-products-chart">{loading ? 'loading' : 'loaded'}</div>,
}));

vi.mock('@/components/admin/PeakHoursChart', () => ({
  PeakHoursChart: ({ loading }: any) => <div data-testid="peak-hours-chart">{loading ? 'loading' : 'loaded'}</div>,
}));

vi.mock('lucide-react', () => ({
  DollarSign: () => null,
  ClipboardList: () => null,
  Users: () => null,
  TrendingUp: () => null,
}));

import { useAdminDashboardStore } from '@/hooks/stores/admin/use-admin-dashboard-store';
import { useAdminOrdersStore } from '@/hooks/stores/admin/use-admin-orders-store';
import { useAdmin } from '@/hooks/use-admin';
import AdminDashboardPage from '@/pages/admin/Dashboard';

function setupStores(overrides: {
  stats?: any;
  statsLoading?: boolean;
  statsError?: string | null;
  orders?: any[];
  ordersLoading?: boolean;
  customers?: any[];
  customersLoading?: boolean;
} = {}) {
  vi.mocked(useAdminDashboardStore).mockReturnValue({
    stats: overrides.stats ?? { todayRevenue: 1500000, todayOrders: 23, activeCustomers: 12, avgOrderValue: 65000 },
    loading: overrides.statsLoading ?? false,
    error: overrides.statsError ?? null,
    fetchDashboard: vi.fn(),
  } as any);

  vi.mocked(useAdminOrdersStore).mockReturnValue({
    orders: overrides.orders ?? [{ id: '1', date: '2026-08-14', status: 'pending' }],
    loading: overrides.ordersLoading ?? false,
    fetchOrders: vi.fn(),
  } as any);

  vi.mocked(useAdmin).mockReturnValue({
    customers: overrides.customers ?? [{ id: 'c1', name: 'A' }],
    isLoadingCustomers: overrides.customersLoading ?? false,
  } as any);
}

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStores();
  });

  afterEach(() => vi.restoreAllMocks());

  it('renders without crashing', () => {
    renderWithProviders(<AdminDashboardPage />);
    expect(screen.getAllByText('dashboard').length).toBeGreaterThanOrEqual(1);
  });

  it('renders stats cards with data', () => {
    renderWithProviders(<AdminDashboardPage />);
    const statsCards = screen.getAllByTestId('stats-card');
    expect(statsCards.length).toBe(4);
  });

  it('shows error state when statsError exists', () => {
    setupStores({ statsError: 'Network error' });
    renderWithProviders(<AdminDashboardPage />);
    expect(screen.getByText('Network error')).toBeTruthy();
    expect(screen.getByText('common:retry')).toBeTruthy();
  });

  it('renders analytics chart sections', () => {
    renderWithProviders(<AdminDashboardPage />);
    expect(screen.getByTestId('revenue-chart')).toBeTruthy();
    expect(screen.getByTestId('top-products-chart')).toBeTruthy();
    expect(screen.getByTestId('peak-hours-chart')).toBeTruthy();
  });

  it('renders recent orders section', () => {
    renderWithProviders(<AdminDashboardPage />);
    expect(screen.getByText('recentOrders')).toBeTruthy();
    expect(screen.getByTestId('order-table')).toBeTruthy();
  });

  it('renders top customers section', () => {
    renderWithProviders(<AdminDashboardPage />);
    expect(screen.getByText('topCustomers')).toBeTruthy();
    expect(screen.getByTestId('customer-table')).toBeTruthy();
  });
});
