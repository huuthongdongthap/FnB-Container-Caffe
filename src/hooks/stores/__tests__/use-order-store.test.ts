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
  customer_address: '29 Nguyen Tat Thanh',
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
  customer_address: '29 Nguyen Tat Thanh',
  payment_method: 'cod',
};

const mockApiFetch = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  API_BASE: '',
}));

/**
 * Real fetch rejects with an AbortError when its signal is already aborted, so a
 * mock that ignores `signal` would let a stale response through and the
 * abort-related assertions would pass for the wrong reason.
 */
function respondWith(value: unknown) {
  mockApiFetch.mockImplementation((_path: string, options?: { signal?: AbortSignal }) => {
    if (options?.signal?.aborted) {
      return Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    }
    return Promise.resolve(value);
  });
}

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

  it('createOrder(): forwards the same optional key across unknown-result retries', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('Response lost')).mockResolvedValueOnce({ data: MOCK_ORDER });
    expect(await useOrderStore.getState().createOrder(MOCK_PAYLOAD, 'checkout-uuid')).toBe(null);
    expect(await useOrderStore.getState().createOrder(MOCK_PAYLOAD, 'checkout-uuid')).toEqual(MOCK_ORDER);
    for (const call of mockApiFetch.mock.calls) expect(call[1].headers).toEqual({ 'Idempotency-Key': 'checkout-uuid' });
  });

  it('createOrder(): keeps keyed checkout offline until it can be confirmed online', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    try {
      expect(await useOrderStore.getState().createOrder(MOCK_PAYLOAD, 'checkout-uuid')).toBe(null);
      expect(mockApiFetch).not.toHaveBeenCalled();
      expect(useOrderStore.getState()).toMatchObject({ loading: false, queuedOffline: false });
      expect(useOrderStore.getState().error).toContain('kết nối mạng');
    } finally { Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); }
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

    expect(mockApiFetch.mock.calls[0]?.[0]).toBe('/api/orders/ord-123');
  });

  it('fetchOrder(): retries the public track endpoint when the owner read is rejected', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('401'));
    mockApiFetch.mockResolvedValueOnce({ data: MOCK_ORDER });

    await useOrderStore.getState().fetchOrder('ord-123');

    expect(mockApiFetch.mock.calls.at(-1)?.[0]).toBe('/api/orders/ord-123/track');
    expect(useOrderStore.getState().currentOrder).toEqual(MOCK_ORDER);
  });

  /* ── SSE / polling lifecycle ── */

  class FakeEventSource {
    static instances: FakeEventSource[] = [];
    onerror: (() => void) | null = null;
    closed = false;
    private listeners: Record<string, Array<(e: MessageEvent) => void>> = {};
    constructor(public url: string, public init?: EventSourceInit) {
      FakeEventSource.instances.push(this);
    }
    addEventListener(type: string, cb: (e: MessageEvent) => void) {
      (this.listeners[type] ||= []).push(cb);
    }
    close() { this.closed = true; }
    emit(type: string, data: unknown) {
      (this.listeners[type] || []).forEach((cb) => cb({ data } as MessageEvent));
    }
  }

  let intervalSpy: ReturnType<typeof vi.spyOn>;
  let clearSpy: ReturnType<typeof vi.spyOn>;

  /**
   * Interval creation count is the real signal for a stacked poller: the store
   * keeps only one pollingId, so counting ids cannot tell one poller from two.
   */
  function intervalsStarted(): number { return intervalSpy.mock.calls.length; }
  function intervalsCleared(): number { return clearSpy.mock.calls.length; }

  /** A cleared interval sheds its timer reference; a live one keeps it. */
  function livePollers(): number {
    const id = useOrderStore.getState().pollingId;
    if (id === null) return 0;
    const handle = id as unknown as { hasRef?: () => boolean };
    return typeof handle.hasRef === 'function' && !handle.hasRef() ? 0 : 1;
  }

  function resetStore() {
    useOrderStore.setState({
      currentOrder: null, orderHistory: [], loading: false, error: null,
      pollingId: null, isPolling: false, eventSource: null, abortController: null,
      queuedOffline: false,
    });
  }

  beforeEach(() => {
    FakeEventSource.instances = [];
    (globalThis as unknown as { EventSource: typeof FakeEventSource }).EventSource = FakeEventSource;
    intervalSpy = vi.spyOn(window, 'setInterval');
    clearSpy = vi.spyOn(window, 'clearInterval');
    resetStore();
  });

  it('subscribeToOrder(): applies a stream update and stops polling on a terminal order', () => {
    useOrderStore.getState().subscribeToOrder('ord-123');
    FakeEventSource.instances[0]?.emit('update_order', JSON.stringify({ id: 'ord-123', status: 'delivered' }));

    expect(useOrderStore.getState().currentOrder?.status).toBe('delivered');

    // A dead stream must not restart polling for an order that is already finished.
    FakeEventSource.instances[0]?.onerror?.();
    expect(intervalsStarted()).toBe(0);
    expect(livePollers()).toBe(0);
  });

  it('repeated stream errors create only one poller', () => {
    useOrderStore.getState().subscribeToOrder('ord-123');
    FakeEventSource.instances[0]?.onerror?.();
    FakeEventSource.instances[0]?.onerror?.();
    FakeEventSource.instances[0]?.onerror?.();

    expect(intervalsStarted()).toBe(1);
    expect(livePollers()).toBe(1);
  });

  it('a timeout handoff followed by an error creates only one poller', () => {
    useOrderStore.getState().subscribeToOrder('ord-123');
    FakeEventSource.instances[0]?.emit('timeout', '{}');
    FakeEventSource.instances[0]?.onerror?.();

    expect(intervalsStarted()).toBe(1);
    expect(livePollers()).toBe(1);
  });

  it('unsubscribeFromOrder(): closes the stream and clears the poller', () => {
    useOrderStore.getState().subscribeToOrder('ord-123');
    FakeEventSource.instances[0]?.onerror?.();
    expect(intervalsStarted()).toBe(1);

    useOrderStore.getState().unsubscribeFromOrder();

    expect(FakeEventSource.instances[0]?.closed).toBe(true);
    expect(useOrderStore.getState().eventSource).toBeNull();
    expect(intervalsCleared()).toBe(1);
    expect(livePollers()).toBe(0);
  });

  it('resubscribing after unsubscribe starts exactly one fresh poller', () => {
    useOrderStore.getState().subscribeToOrder('ord-123');
    FakeEventSource.instances[0]?.onerror?.();
    useOrderStore.getState().unsubscribeFromOrder();

    useOrderStore.getState().subscribeToOrder('ord-123');
    FakeEventSource.instances[1]?.onerror?.();

    expect(FakeEventSource.instances).toHaveLength(2);
    expect(intervalsStarted()).toBe(2);
    expect(intervalsCleared()).toBe(1);
    expect(livePollers()).toBe(1);
  });

  it('discards a poll response that lands after the subscription is dropped', async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    const pending = new Promise((resolve) => { resolveFetch = resolve; });
    mockApiFetch.mockReturnValue(pending);

    useOrderStore.getState().subscribeToOrder('ord-123');
    FakeEventSource.instances[0]?.onerror?.();
    expect(intervalsStarted()).toBe(1);

    const fetch = useOrderStore.getState().fetchOrder('ord-123');
    useOrderStore.getState().unsubscribeFromOrder();

    resolveFetch({ data: MOCK_ORDER });
    await fetch;

    expect(useOrderStore.getState().currentOrder).toBeNull();
  });

  it('applies a poll response while the subscription is still live', async () => {
    respondWith({ data: MOCK_ORDER });

    useOrderStore.getState().subscribeToOrder('ord-123');
    FakeEventSource.instances[0]?.onerror?.();
    await useOrderStore.getState().fetchOrder('ord-123');

    expect(useOrderStore.getState().currentOrder).toEqual(MOCK_ORDER);
    expect(livePollers()).toBe(1);
  });

  it('stops polling once a polled order reaches a terminal status', async () => {
    respondWith({
      data: {
        id: 'ord-123', orderNumber: 'A-001', table: null, items: [],
        channel: 'dine_in', subtotal: 85000, discountAmount: 0, taxAmount: 0,
        totalAmount: 85000, status: 'delivered', paymentStatus: 'unpaid',
        createdAt: '2026-07-01T12:00:00Z', updatedAt: '2026-07-01T12:00:00Z',
      },
    });

    useOrderStore.getState().startPolling('ord-123');
    expect(intervalsStarted()).toBe(1);
    await useOrderStore.getState().fetchOrder('ord-123');

    expect(intervalsCleared()).toBe(1);
    expect(livePollers()).toBe(0);
  });

  it('refuses to start polling for an already terminal order', () => {
    useOrderStore.setState({
      currentOrder: {
        id: 'ord-123', orderNumber: 'A-001', table: null, items: [],
        channel: 'dine_in', subtotal: 85000, discountAmount: 0, taxAmount: 0,
        totalAmount: 85000, status: 'cancelled', paymentStatus: 'unpaid',
        createdAt: '2026-07-01T12:00:00Z', updatedAt: '2026-07-01T12:00:00Z',
      },
    });

    useOrderStore.getState().startPolling('ord-123');

    expect(intervalsStarted()).toBe(0);
    expect(useOrderStore.getState().pollingId).toBeNull();
  });
});
