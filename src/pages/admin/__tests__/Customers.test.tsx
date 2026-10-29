import React from 'react';
import { act } from '@testing-library/react';
import { saveClientSession } from '@/lib/client-session';
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
    setupStore({
      customers: [
        { id: '1', name: 'Alice', phone: '0901111111', totalOrders: 5, totalSpent: 1200000, tier: 'gold', lastVisit: '2026-08-01' },
        { id: '2', name: 'Bob', phone: '0902222222', totalOrders: 2, totalSpent: 450000, tier: 'silver', lastVisit: '2026-07-20' },
      ],
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('renders page title', () => {
    renderWithProviders(<AdminCustomersPage />);
    expect(screen.getByText('Customer Management')).toBeTruthy();
  });

  it('shows customer count when data loaded', () => {
    setupStore({
      customers: [
        { id: '1', name: 'Alice', phone: '0901111111', totalOrders: 5, totalSpent: 1200000, tier: 'gold', lastVisit: '2026-08-01' },
        { id: '2', name: 'Bob', phone: '0902222222', totalOrders: 2, totalSpent: 450000, tier: 'silver', lastVisit: '2026-07-20' },
        { id: '3', name: 'Carol', phone: '0903333333', totalOrders: 1, totalSpent: 120000, tier: 'bronze', lastVisit: '2026-07-10' },
      ],
      loading: false,
    });
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
  it('preserves failed customer inputs and retries the same submission key', async () => {
    const addCustomer = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    setupStore({ addCustomer }); renderWithProviders(<AdminCustomersPage />);
    fireEvent.click(screen.getByText('Thêm Khách Hàng'));
    fireEvent.change(screen.getByPlaceholderText('Nguyễn Văn A'), { target: { value: 'Private A' } });
    fireEvent.change(screen.getByPlaceholderText('0946013633'), { target: { value: '0901234567' } });
    fireEvent.click(screen.getByText('Lưu Khách Hàng'));
    expect(await screen.findByText('Chưa xác nhận đã lưu thông tin khách hàng. Vui lòng thử lại.')).toBeTruthy();
    expect(screen.getByDisplayValue('Private A')).toBeTruthy();
    fireEvent.click(screen.getByText('Lưu Khách Hàng'));
    await waitFor(() => expect(screen.queryByPlaceholderText('Nguyễn Văn A')).toBeNull());
    expect(addCustomer.mock.calls[0]?.[1]).toBe(addCustomer.mock.calls[1]?.[1]);
  });
  it('unmounts A’s held PII and A’s late callback cannot close B’s customer form', async () => {
    let resolveA!: (body: boolean) => void;
    let resolveB!: (body: boolean) => void;
    const addCustomer = vi.fn().mockReturnValueOnce(new Promise<boolean>(r => { resolveA = r; }))
      .mockReturnValueOnce(new Promise<boolean>(r => { resolveB = r; }));
    setupStore({ addCustomer }); renderWithProviders(<AdminCustomersPage />);
    fireEvent.click(screen.getByText('Thêm Khách Hàng'));
    const fill = (name: string) => {
      fireEvent.change(screen.getByPlaceholderText('Nguyễn Văn A'), { target: { value: name } });
      fireEvent.change(screen.getByPlaceholderText('0946013633'), { target: { value: '0901234567' } });
    };
    fill('Private A'); fireEvent.submit(screen.getByPlaceholderText('Nguyễn Văn A').closest('form')!);
    fireEvent.submit(screen.getByPlaceholderText('Nguyễn Văn A').closest('form')!);
    expect(addCustomer).toHaveBeenCalledTimes(1);
    act(() => saveClientSession('owner-b', { id: 'b', role: 'owner', name: 'B' }));
    expect(screen.queryByDisplayValue('Private A')).toBeNull();
    fireEvent.click(screen.getByText('Thêm Khách Hàng')); fill('Private B');
    fireEvent.submit(screen.getByPlaceholderText('Nguyễn Văn A').closest('form')!);
    await act(async () => resolveA(true));
    expect(screen.getByDisplayValue('Private B')).toBeTruthy();
    expect(screen.getByText('Đang lưu...').closest('button')).toBeDisabled();
    await act(async () => resolveB(false));
    expect(screen.getByDisplayValue('Private B')).toBeTruthy();
  });

});
