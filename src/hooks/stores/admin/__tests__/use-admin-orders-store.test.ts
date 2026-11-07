import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAdminOrdersStore } from '@/hooks/stores/admin/use-admin-orders-store';

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

describe('useAdminOrdersStore', () => {
  beforeEach(() => {
    useAdminOrdersStore.setState({ orders: [], totalCount: 0, loading: false, error: null });
    vi.restoreAllMocks();
    mockApiFetch.mockReset();
  });

  it('starts with empty orders, loading=false, error=null', () => {
    const s = useAdminOrdersStore.getState();
    expect(s.orders).toEqual([]);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchOrders(): populates orders on success', async () => {
    const fakeOrders = [
      { id: 'ORD-001', customer: 'Nguyen Van A', items: 3, total: 185000, status: 'pending', payment: 'cash', createdAt: '2026-07-01T09:00:00Z' },
    ];
    mockSuccess({ orders: fakeOrders, totalCount: 1 });

    await useAdminOrdersStore.getState().fetchOrders();

    const s = useAdminOrdersStore.getState();
    expect(s.orders).toEqual(fakeOrders);
    expect(s.totalCount).toBe(1);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchOrders(): normalizes D1 snake_case orders and pagination.total from /api/admin/orders', async () => {
    mockSuccess({
      success: true,
      orders: [
        {
          id: 'ORD-D1-1',
          customer_name: 'Le Van C',
          items: [{ name: 'Latte', quantity: 2 }, { name: 'Croissant', quantity: 1 }],
          total: 145000,
          status: 'preparing',
          payment_method: 'payos',
          created_at: '2026-10-14T10:00:00Z',
        },
      ],
      pagination: { total: 17, limit: 50, offset: 0 },
    });

    await useAdminOrdersStore.getState().fetchOrders();

    const s = useAdminOrdersStore.getState();
    expect(s.totalCount).toBe(17);
    expect(s.orders[0]).toMatchObject({
      id: 'ORD-D1-1',
      customer: 'Le Van C',
      items: 3,
      total: 145000,
      status: 'preparing',
      payment: 'payos',
      createdAt: '2026-10-14T10:00:00Z',
    });
  });

  it('fetchOrders(): sets error on failure', async () => {
    mockError('Không thể tải danh sách đơn hàng');

    await useAdminOrdersStore.getState().fetchOrders();

    expect(useAdminOrdersStore.getState().error).toContain('Không thể tải danh sách đơn hàng');
  });

  it('fetchOrders(): passes filter and pagination params', async () => {
    mockSuccess({ orders: [], totalCount: 0 });

    await useAdminOrdersStore.getState().fetchOrders(2, { status: 'pending', payment: 'cash', search: 'test' }, 12);

    expect(mockApiFetch).toHaveBeenCalled();
    const url = mockApiFetch.mock.calls[0]![0] as string;
    expect(url).toContain('page=2');
    expect(url).toContain('limit=12');
    expect(url).toContain('offset=12');
    expect(url).toContain('status=pending');
    expect(url).toContain('payment_status=cash');
    expect(url).toContain('search=test');
  });

  it('fetchOrders(): discards stale out-of-order response when a newer request is already in flight', async () => {
    let resolvePage1: (value: unknown) => void = () => {};
    let resolvePage2: (value: unknown) => void = () => {};
    mockApiFetch
      .mockImplementationOnce(
        () => new Promise((resolve) => { resolvePage1 = resolve; }),
      )
      .mockImplementationOnce(
        () => new Promise((resolve) => { resolvePage2 = resolve; }),
      );

    const p1 = useAdminOrdersStore.getState().fetchOrders(1, { status: 'pending' }, 12);
    const p2 = useAdminOrdersStore.getState().fetchOrders(2, { status: 'preparing' }, 12);

    resolvePage2({
      orders: [{ id: 'ORD-PAGE-2', customer: 'Page Two', items: 1, total: 50000, status: 'preparing', payment: 'cash', createdAt: '2026-10-14T11:00:00Z' }],
      totalCount: 24,
    });
    await p2;

    resolvePage1({
      orders: [{ id: 'ORD-PAGE-1-STALE', customer: 'Stale One', items: 1, total: 40000, status: 'pending', payment: 'cash', createdAt: '2026-10-14T10:00:00Z' }],
      totalCount: 99,
    });
    await p1;

    const state = useAdminOrdersStore.getState();
    expect(state.page).toBe(2);
    expect(state.totalCount).toBe(24);
    expect(state.orders.map((o) => o.id)).toEqual(['ORD-PAGE-2']);
  });

  it('updateOrderStatus(): calls apiFetch with PATCH and refreshes current page/filters', async () => {
    useAdminOrdersStore.setState({
      page: 3,
      pageSize: 12,
      activeFilters: { status: 'preparing', search: 'VIP' },
    });
    mockSuccess({});
    mockSuccess({ orders: [], totalCount: 0 });

    await useAdminOrdersStore.getState().updateOrderStatus('ORD-001', 'completed');

    expect(mockApiFetch).toHaveBeenCalledWith('/api/orders/ORD-001', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed' }),
    });
    const refreshUrl = mockApiFetch.mock.calls[1]![0] as string;
    expect(refreshUrl).toContain('page=3');
    expect(refreshUrl).toContain('offset=24');
    expect(refreshUrl).toContain('status=preparing');
    expect(refreshUrl).toContain('search=VIP');
  });
});
