import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAdminCustomersStore } from '@/hooks/stores/admin/use-admin-customers-store';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

function setAuthenticated() {
  useAuthStore.setState({
    token: 'valid-token',
    user: { id: '1', name: 'Admin', email: 'admin@aura.vn', role: 'owner' },
  });
}

function setUnauthenticated() {
  useAuthStore.setState({ token: null, user: null });
}

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }));
}

describe('useAdminCustomersStore', () => {
  beforeEach(() => {
    useAdminCustomersStore.setState({ customers: [], totalCount: 0, loading: false, error: null });
    setUnauthenticated();
    vi.restoreAllMocks();
  });

  it('starts with empty customers, loading=false, error=null', () => {
    const s = useAdminCustomersStore.getState();
    expect(s.customers).toEqual([]);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchCustomers(): populates customers on success', async () => {
    setAuthenticated();
    const fakeCustomers = [
      { id: 'C001', name: 'Nguyen Van A', phone: '0901234567', totalOrders: 5, totalSpent: 500000, tier: 'VIP', lastVisit: '2026-06-30' },
    ];
    mockFetch(200, { customers: fakeCustomers, totalCount: 1 });

    await useAdminCustomersStore.getState().fetchCustomers();

    const s = useAdminCustomersStore.getState();
    expect(s.customers).toEqual(fakeCustomers);
    expect(s.totalCount).toBe(1);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchCustomers(): sets error when no token', async () => {
    await useAdminCustomersStore.getState().fetchCustomers();

    expect(useAdminCustomersStore.getState().error).toContain('Chưa đăng nhập');
  });

  it('fetchCustomers(): sets error on 401', async () => {
    setAuthenticated();
    mockFetch(401, { message: 'Unauthorized' });

    await useAdminCustomersStore.getState().fetchCustomers();

    expect(useAdminCustomersStore.getState().error).toContain('Phiên đăng nhập');
  });

  it('fetchCustomers(): passes search param to API', async () => {
    setAuthenticated();
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ customers: [], totalCount: 0 }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await useAdminCustomersStore.getState().fetchCustomers(1, 'Nguyen');

    const callUrl = fetchSpy.mock.calls[0]![0] as string;
    expect(callUrl).toContain('search=Nguyen');
  });

  it('fetchCustomers(): sets error on network failure', async () => {
    setAuthenticated();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    await useAdminCustomersStore.getState().fetchCustomers();

    expect(useAdminCustomersStore.getState().error).toContain('Network');
  });
});
