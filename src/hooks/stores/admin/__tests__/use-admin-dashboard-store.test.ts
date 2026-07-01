import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAdminDashboardStore } from '@/hooks/stores/admin/use-admin-dashboard-store';
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

describe('useAdminDashboardStore', () => {
  beforeEach(() => {
    useAdminDashboardStore.setState({ stats: null, loading: false, error: null });
    setUnauthenticated();
    vi.restoreAllMocks();
  });

  it('starts with null stats, loading=false, error=null', () => {
    const s = useAdminDashboardStore.getState();
    expect(s.stats).toBeNull();
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchDashboard(): populates stats on success', async () => {
    setAuthenticated();
    const fakeStats = {
      todayRevenue: 12500000,
      todayOrders: 42,
      avgOrderValue: 297619,
      activeCustomers: 18,
    };
    mockFetch(200, fakeStats);

    await useAdminDashboardStore.getState().fetchDashboard();

    const s = useAdminDashboardStore.getState();
    expect(s.stats).toEqual(fakeStats);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchDashboard(): sets error when no token', async () => {
    await useAdminDashboardStore.getState().fetchDashboard();

    expect(useAdminDashboardStore.getState().error).toContain('Chưa đăng nhập');
  });

  it('fetchDashboard(): sets error on 401', async () => {
    setAuthenticated();
    mockFetch(401, { message: 'Unauthorized' });

    await useAdminDashboardStore.getState().fetchDashboard();

    expect(useAdminDashboardStore.getState().error).toContain('Phiên đăng nhập');
  });

  it('fetchDashboard(): sends request with Bearer token', async () => {
    setAuthenticated();
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ todayRevenue: 0, todayOrders: 0, avgOrderValue: 0, activeCustomers: 0 }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await useAdminDashboardStore.getState().fetchDashboard();

    const headers = fetchSpy.mock.calls[0]![1]?.headers as Record<string, string> | undefined;
    expect(headers?.Authorization).toContain('Bearer valid-token');
  });
});
