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

  it('fetchOrders(): sets error on failure', async () => {
    mockError('Không thể tải danh sách đơn hàng');

    await useAdminOrdersStore.getState().fetchOrders();

    expect(useAdminOrdersStore.getState().error).toContain('Không thể tải danh sách đơn hàng');
  });

  it('fetchOrders(): passes filter params', async () => {
    mockSuccess({ orders: [], totalCount: 0 });

    await useAdminOrdersStore.getState().fetchOrders(1, { status: 'pending', payment: 'cash', search: 'test' });

    expect(mockApiFetch).toHaveBeenCalled();
    const url = mockApiFetch.mock.calls[0]![0] as string;
    expect(url).toContain('status=pending');
    expect(url).toContain('payment=cash');
    expect(url).toContain('search=test');
  });

  it('updateOrderStatus(): calls apiFetch with PATCH', async () => {
    mockSuccess({});
    mockSuccess({ orders: [], totalCount: 0 });

    await useAdminOrdersStore.getState().updateOrderStatus('ORD-001', 'completed');

    expect(mockApiFetch).toHaveBeenCalledWith('/api/orders/ORD-001', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed' }),
    });
  });
});
