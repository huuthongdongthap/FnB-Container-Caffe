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
    { id: '1', name: 'Ca phe sua da', price: 35000, quantity: 2 },
  ],
  created_at: '2026-07-01T12:00:00Z',
};

const MOCK_PAYLOAD: CreateOrderPayload = {
  items: [{ id: '1', name: 'Ca phe sua da', price: 35000, quantity: 2 }],
  total: 85000,
  customer_name: 'Nguyen Van A',
  customer_phone: '0912345678',
  customer_address: '39 Nguyen Tat Thanh',
  payment_method: 'cod',
};

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

describe('useOrderStore', () => {
  beforeEach(() => {
    useOrderStore.setState({
      currentOrder: null,
      orderHistory: [],
      loading: false,
      error: null,
    });
    vi.restoreAllMocks();
    mockApiFetch.mockReset();
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
  it('createOrder(): returns order with ID on success', async () => {
    mockSuccess({ success: true, data: MOCK_ORDER });

    const result = await useOrderStore.getState().createOrder(MOCK_PAYLOAD);

    expect(result).toEqual(MOCK_ORDER);
    expect(useOrderStore.getState().currentOrder).toEqual(MOCK_ORDER);
    expect(useOrderStore.getState().loading).toBe(false);
    expect(useOrderStore.getState().error).toBeNull();
  });

  it('createOrder(): returns null on API failure', async () => {
    mockError('Order creation failed');

    const result = await useOrderStore.getState().createOrder(MOCK_PAYLOAD);

    expect(result).toBeNull();
    expect(useOrderStore.getState().error).toBeTruthy();
  });

  it('createOrder(): calls apiFetch with POST', async () => {
    mockSuccess({ success: true, data: MOCK_ORDER });

    await useOrderStore.getState().createOrder(MOCK_PAYLOAD);

    expect(mockApiFetch).toHaveBeenCalledWith('/api/orders', {
      method: 'POST',
      body: JSON.stringify(MOCK_PAYLOAD),
    });
  });

  /* ── fetchOrder ── */
  it('fetchOrder(): populates currentOrder on success', async () => {
    mockSuccess({ data: MOCK_ORDER });

    await useOrderStore.getState().fetchOrder('ord-123');

    expect(useOrderStore.getState().currentOrder).toEqual(MOCK_ORDER);
    expect(useOrderStore.getState().loading).toBe(false);
  });

  it('fetchOrder(): sets error on failure', async () => {
    mockError('Not found');

    await useOrderStore.getState().fetchOrder('ord-999');

    expect(useOrderStore.getState().error).toBeTruthy();
    expect(useOrderStore.getState().loading).toBe(false);
  });

  it('fetchOrder(): calls apiFetch with correct path', async () => {
    mockSuccess({ data: MOCK_ORDER });

    await useOrderStore.getState().fetchOrder('ord-123');

    expect(mockApiFetch).toHaveBeenCalledWith('/api/orders/ord-123');
  });
});
