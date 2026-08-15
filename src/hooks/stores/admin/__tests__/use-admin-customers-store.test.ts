import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAdminCustomersStore } from '@/hooks/stores/admin/use-admin-customers-store';

const mockApiFetch = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

function mockSuccess(data: unknown) {
  mockApiFetch.mockResolvedValue(data);
}

function mockError(message: string) {
  mockApiFetch.mockRejectedValue(new Error(message));
}

describe('useAdminCustomersStore', () => {
  beforeEach(() => {
    useAdminCustomersStore.setState({ customers: [], totalCount: 0, loading: false, error: null });
    vi.restoreAllMocks();
    mockApiFetch.mockReset();
  });

  it('starts with empty customers, loading=false, error=null', () => {
    const s = useAdminCustomersStore.getState();
    expect(s.customers).toEqual([]);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchCustomers(): populates customers on success', async () => {
    const fakeCustomers = [
      { id: 'C001', name: 'Nguyen Van A', phone: '0901234567', totalOrders: 5, totalSpent: 500000, tier: 'VIP', lastVisit: '2026-06-30' },
    ];
    mockSuccess({ customers: fakeCustomers, totalCount: 1 });

    await useAdminCustomersStore.getState().fetchCustomers();

    const s = useAdminCustomersStore.getState();
    expect(s.customers).toEqual(fakeCustomers);
    expect(s.totalCount).toBe(1);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchCustomers(): sets error on failure', async () => {
    mockError('Không thể tải danh sách khách hàng');

    await useAdminCustomersStore.getState().fetchCustomers();

    expect(useAdminCustomersStore.getState().error).toContain('Không thể tải danh sách khách hàng');
  });

  it('fetchCustomers(): passes search params', async () => {
    mockSuccess({ customers: [], totalCount: 0 });

    await useAdminCustomersStore.getState().fetchCustomers(2, 'test');

    expect(mockApiFetch).toHaveBeenCalled();
    const url = mockApiFetch.mock.calls[0][0] as string;
    expect(url).toContain('page=2');
    expect(url).toContain('search=test');
  });
});
