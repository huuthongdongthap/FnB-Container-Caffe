import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAdminOrdersStore } from '@/hooks/stores/admin/use-admin-orders-store';
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

describe('useAdminOrdersStore', () => {
  beforeEach(() => {
    useAdminOrdersStore.setState({ orders: [], totalCount: 0, loading: false, error: null });
    setUnauthenticated();
    vi.restoreAllMocks();
  });

  it('starts with empty orders, loading=false, error=null', () => {
    const s = useAdminOrdersStore.getState();
    expect(s.orders).toEqual([]);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchOrders(): populates orders on success', async () => {
    setAuthenticated();
    const fakeOrders = [
      { id: 'ORD-001', customer: 'Nguyen Van A', items: 3, total: 185000, status: 'pending', payment: 'cash', createdAt: '2026-07-01T09:00:00Z' },
    ];
    mockFetch(200, { orders: fakeOrders, totalCount: 1 });

    await useAdminOrdersStore.getState().fetchOrders();

    const s = useAdminOrdersStore.getState();
    expect(s.orders).toEqual(fakeOrders);
    expect(s.totalCount).toBe(1);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchOrders(): sets error when no token', async () => {
    await useAdminOrdersStore.getState().fetchOrders();

    expect(useAdminOrdersStore.getState().error).toContain('Chưa đăng nhập');
  });

  it('fetchOrders(): sets error on 401', async () => {
    setAuthenticated();
    mockFetch(401, { message: 'Unauthorized' });

    await useAdminOrdersStore.getState().fetchOrders();

    expect(useAdminOrdersStore.getState().error).toContain('Phiên đăng nhập');
  });

  it('fetchOrders(): passes search/pagination params', async () => {
    setAuthenticated();
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ orders: [], totalCount: 0 }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await useAdminOrdersStore.getState().fetchOrders(2, { status: 'pending', search: 'test' });

    const callUrl = fetchSpy.mock.calls[0]![0] as string;
    expect(callUrl).toContain('page=2');
    expect(callUrl).toContain('status=pending');
    expect(callUrl).toContain('search=test');
  });

  it('updateOrderStatus(): calls PATCH with correct body and refreshes', async () => {
    setAuthenticated();

    let patchCalled = false;
    vi.stubGlobal('fetch', vi.fn((url: string, opts?: RequestInit) => {
      if (opts?.method === 'PATCH') {
        patchCalled = true;
        expect(url).toContain('/api/orders/ORD-001');
        const body = JSON.parse(opts.body as string);
        expect(body.status).toBe('confirmed');
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ orders: [], totalCount: 0 }) });
    }));

    await useAdminOrdersStore.getState().updateOrderStatus('ORD-001', 'confirmed');

    expect(patchCalled).toBe(true);
  });

  it('updateOrderStatus(): sets error on network failure', async () => {
    setAuthenticated();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    await useAdminOrdersStore.getState().updateOrderStatus('ORD-001', 'confirmed');

    expect(useAdminOrdersStore.getState().error).toContain('Network');
  });
});
