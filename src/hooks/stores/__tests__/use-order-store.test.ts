import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useOrderStore } from '@/hooks/stores/use-order-store';
import type { CreateOrderPayload } from '@/hooks/stores/use-order-store';

const MOCK_ORDER = {
  id: 'ord-123',
  status: 'pending',
  total: 85000,
  payment_status: 'unpaid',
  payment_method: 'cod',
  customer_name: 'Nguyen Van A',
  customer_phone: '0912345678',
  customer_address: '39 Nguyen Tat Thanh',
  items: [
    { id: '1', name: 'Cà phê sữa đá', price: 35000, quantity: 2 },
  ],
  created_at: '2026-07-01T12:00:00Z',
};

const MOCK_PAYLOAD: CreateOrderPayload = {
  items: [{ id: '1', name: 'Cà phê sữa đá', price: 35000, quantity: 2 }],
  total: 85000,
  customer_name: 'Nguyen Van A',
  customer_phone: '0912345678',
  customer_address: '39 Nguyen Tat Thanh',
  payment_method: 'cod',
};

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }));
}

describe('useOrderStore', () => {
  beforeEach(() => {
    useOrderStore.setState({
      currentOrder: null,
      orderHistory: [],
      loading: false,
      error: null,
    });
    vi.restoreAllMocks();
  });

  /* ── Initial state ── */
  it('starts with null currentOrder, empty history, loading=false', () => {
    const s = useOrderStore.getState();
    expect(s.currentOrder).toBeNull();
    expect(s.orderHistory).toEqual([]);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  /* ── createOrder ── */
  it('createOrder(): POST /api/orders, returns order with ID on success', async () => {
    mockFetch(201, { success: true, data: MOCK_ORDER });

    const result = await useOrderStore.getState().createOrder(MOCK_PAYLOAD);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('ord-123');
    expect(result!.status).toBe('pending');
    expect(result!.total).toBe(85000);

    const s = useOrderStore.getState();
    expect(s.currentOrder).toEqual(MOCK_ORDER);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('createOrder(): sets error on 400 validation failure', async () => {
    mockFetch(400, { message: 'Số điện thoại không hợp lệ' });

    const result = await useOrderStore.getState().createOrder(MOCK_PAYLOAD);

    expect(result).toBeNull();
    const s = useOrderStore.getState();
    expect(s.error).toContain('Số điện thoại');
    expect(s.loading).toBe(false);
  });

  it('createOrder(): sets error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const result = await useOrderStore.getState().createOrder(MOCK_PAYLOAD);

    expect(result).toBeNull();
    const s = useOrderStore.getState();
    expect(s.error).toContain('Network');
    expect(s.loading).toBe(false);
  });

  it('createOrder(): handles { success, data } response wrapper', async () => {
    // Backend always returns { success: true, data: <order> }
    mockFetch(200, { success: true, data: MOCK_ORDER });

    const result = await useOrderStore.getState().createOrder(MOCK_PAYLOAD);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('ord-123');
    expect(useOrderStore.getState().currentOrder).toEqual(MOCK_ORDER);
  });

  /* ── fetchOrder ── */
  it('fetchOrder(id): GET /api/orders/:id, populates currentOrder', async () => {
    mockFetch(200, { success: true, data: MOCK_ORDER });

    await useOrderStore.getState().fetchOrder('ord-123');

    const s = useOrderStore.getState();
    expect(s.currentOrder).toEqual(MOCK_ORDER);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchOrder(id): sets error on 404', async () => {
    mockFetch(404, { message: 'Not found' });

    await useOrderStore.getState().fetchOrder('ord-999');

    const s = useOrderStore.getState();
    expect(s.error).toContain('Không tìm thấy');
    expect(s.loading).toBe(false);
    expect(s.currentOrder).toBeNull();
  });

  it('fetchOrder(id): sets error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    await useOrderStore.getState().fetchOrder('ord-123');

    const s = useOrderStore.getState();
    expect(s.error).toContain('Network');
    expect(s.loading).toBe(false);
  });
});
