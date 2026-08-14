import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, waitFor, fireEvent } from '@/test-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, opts?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        title: 'Customer Management',
        loading: 'Loading...',
        customerCount: '{{count}} customers',
        search: 'Search',
        searchPlaceholder: 'Search by name or phone',
        tierFilter: 'Tier',
        allTiers: 'All Tiers',
        loyal: 'Loyal',
        regular: 'Regular',
        emptyTitle: 'No customers found',
        emptyNoOrders: 'No customers with orders yet',
        emptyFiltered: 'No results for current filters',
        clearFilters: 'Clear filters',
        retry: 'Retry',
      };
      let text = map[key ?? ''] ?? key ?? '';
      if (opts) {
        for (const [k, v] of Object.entries(opts)) {
          text = text.replaceAll(`{{${k}}}`, String(v));
        }
      }
      return text;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/hooks/stores/admin/use-admin-customers-store', () => ({
  useAdminCustomersStore: vi.fn(),
}));

vi.mock('@/components/admin/CustomerTable', () => ({
  CustomerTable: ({ customers, tierFilter }: any) => (
    <div data-testid="customer-table">
      <span data-testid="customer-count">{customers.length}</span>
      {tierFilter && <span data-testid="tier-filter">{tierFilter}</span>}
    </div>
  ),
}));

const mockFetchCustomers = vi.fn();

import { useAdminCustomersStore } from '@/hooks/stores/admin/use-admin-customers-store';
import AdminCustomersPage from '@/pages/admin/Customers';

function setupStore(overrides: Partial<ReturnType<typeof useAdminCustomersStore.getState>> = {}) {
  const defaults = {
    customers: [] as any[],
    totalCount: 0,
    loading: false,
    error: null as string | null,
    fetchCustomers: mockFetchCustomers,
    ...overrides,
  };
  vi.mocked(useAdminCustomersStore).mockReturnValue(defaults as any);
}

describe('AdminCustomersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore({ customers: [{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }] });
  });

  afterEach(() => vi.restoreAllMocks());

  it('renders page title', () => {
    renderWithProviders(<AdminCustomersPage />);
    expect(screen.getByText('Customer Management')).toBeTruthy();
  });

  it('shows customer count when data loaded', () => {
    setupStore({ customers: [{ id: '1' }, { id: '2' }, { id: '3' }], loading: false });
    renderWithProviders(<AdminCustomersPage />);
    expect(screen.getByText('3 customers')).toBeTruthy();
  });

  it('shows loading text while fetching', () => {
    setupStore({ loading: true, customers: [] });
    renderWithProviders(<AdminCustomersPage />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('renders search input and tier filter dropdown', () => {
    renderWithProviders(<AdminCustomersPage />);
    expect(screen.getByPlaceholderText('Search by name or phone')).toBeTruthy();
    // Find the tier select by looking for select elements
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThanOrEqual(1);
  });

  it('shows error banner with retry button when error exists', () => {
    setupStore({ error: 'Failed to load', customers: [] });
    renderWithProviders(<AdminCustomersPage />);
    expect(screen.getByText('Failed to load')).toBeTruthy();
    expect(screen.getByText('Retry')).toBeTruthy();
  });
});
