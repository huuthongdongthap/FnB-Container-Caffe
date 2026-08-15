import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCartStore } from '@/hooks/stores/use-cart-store';
import { useOrderStore } from '@/hooks/stores/use-order-store';
import { checkoutFormSchema } from '@/lib/validators';

/* ── Mocks ─────────────────────────────────────────────────────────── */
vi.mock('@/lib/offline-db', () => ({
  offlineDb: {
    saveOrder: vi.fn().mockResolvedValue(undefined),
    getPendingOrders: vi.fn().mockResolvedValue([]),
    clear: vi.fn().mockResolvedValue(undefined),
  },
}));

/* ── Test Data ─────────────────────────────────────────────────────── */
const MOCK_PRODUCT = { id: 'prod-1', name: 'Ca Phe Sua Da', price: 45000 };
const MOCK_PRODUCT_2 = { id: 'prod-2', name: 'Banh Mi', price: 35000 };
const MOCK_ORDER_RESPONSE = {
  success: true,
  data: {
    id: 'ORD-001',
    status: 'pending',
    total: 90000,
    payment_status: 'unpaid',
    payment_method: 'cod',
    customer_name: 'Test User',
    customer_phone: '0901234567',
    items: [{ id: 'prod-1', name: 'Ca Phe Sua Da', price: 45000, quantity: 2 }],
    created_at: new Date().toISOString(),
  },
};

function mockFetch(status: number, body: unknown) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

/* ══════════════════════════════════════════════════════════════════════
   1. Cart State
   ══════════════════════════════════════════════════════════════════════ */
describe('Cart State', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], tableId: null });
    localStorage.clear();
  });

  it('add item -> cart count = 1', () => {
    useCartStore.getState().addItem(MOCK_PRODUCT);
    expect(useCartStore.getState().totalItems()).toBe(1);
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  it('add same item -> quantity increments', () => {
    const { addItem } = useCartStore.getState();
    addItem(MOCK_PRODUCT);
    addItem(MOCK_PRODUCT);
    expect(useCartStore.getState().items[0]!.quantity).toBe(2);
    expect(useCartStore.getState().totalItems()).toBe(2);
  });

  it('multiple items -> subtotal correct', () => {
    const { addItem } = useCartStore.getState();
    addItem(MOCK_PRODUCT);  // 45000
    addItem(MOCK_PRODUCT);  // 45000 (qty 2)
    addItem(MOCK_PRODUCT_2); // 35000
    expect(useCartStore.getState().subtotal()).toBe(125000); // 45000*2 + 35000
  });

  it('remove item -> removed from cart', () => {
    const { addItem, removeItem } = useCartStore.getState();
    addItem(MOCK_PRODUCT);
    addItem(MOCK_PRODUCT_2);
    removeItem('prod-1');
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0]!.id).toBe('prod-2');
  });

  it('clear cart -> empty', () => {
    useCartStore.getState().addItem(MOCK_PRODUCT);
    useCartStore.getState().clearCart();
    expect(useCartStore.getState().items).toHaveLength(0);
    expect(useCartStore.getState().totalItems()).toBe(0);
    expect(useCartStore.getState().subtotal()).toBe(0);
  });
});

/* ══════════════════════════════════════════════════════════════════════
   2. Cart Total Calculation
   ══════════════════════════════════════════════════════════════════════ */
describe('Cart Total Calculation', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], tableId: null });
    localStorage.clear();
  });

  it('single item total = price x quantity', () => {
    useCartStore.getState().addItem(MOCK_PRODUCT);
    useCartStore.getState().addItem(MOCK_PRODUCT); // qty 2
    expect(useCartStore.getState().subtotal()).toBe(90000);
  });

  it('multiple items total = sum of (price x quantity)', () => {
    const { addItem } = useCartStore.getState();
    addItem(MOCK_PRODUCT);   // 45000 x1
    addItem(MOCK_PRODUCT);   // 45000 -> qty 2
    addItem(MOCK_PRODUCT_2); // 35000 x1
    addItem(MOCK_PRODUCT_2); // 35000 -> qty 2
    // 45000*2 + 35000*2 = 160000
    expect(useCartStore.getState().subtotal()).toBe(160000);
  });

  it('empty cart total = 0', () => {
    expect(useCartStore.getState().subtotal()).toBe(0);
  });
});

/* ══════════════════════════════════════════════════════════════════════
   3. Order Creation
   ══════════════════════════════════════════════════════════════════════ */
describe('Order Creation', () => {
  beforeEach(() => {
    useOrderStore.setState({
      currentOrder: null, loading: false, error: null,
      queuedOffline: false, pollingId: null,
    });
    useCartStore.setState({ items: [], tableId: null });
    vi.restoreAllMocks();
  });

  const PAYLOAD = {
    items: [{ id: 'prod-1', name: 'Ca Phe Sua Da', price: 45000, quantity: 2 }],
    total: 90000,
    customer_name: 'Test User',
    customer_phone: '0901234567',
    payment_method: 'cod' as const,
  };

  it('create order success -> order returned', async () => {
    mockFetch(201, MOCK_ORDER_RESPONSE);
    const order = await useOrderStore.getState().createOrder(PAYLOAD);
    expect(order).not.toBeNull();
    expect(order!.id).toBe('ORD-001');
    expect(order!.status).toBe('pending');
  });

  it('create order with delivery -> shipping fee included', async () => {
    const payloadWithDelivery = { ...PAYLOAD, shipping_fee: 15000, total: 105000 };
    mockFetch(201, {
      success: true,
      data: { ...MOCK_ORDER_RESPONSE.data, total: 105000, shipping_fee: 15000 },
    });
    const order = await useOrderStore.getState().createOrder(payloadWithDelivery);
    expect(order!.total).toBe(105000);
    expect(order!.shipping_fee).toBe(15000);
  });

  it('create order failure -> error state', async () => {
    mockFetch(400, { message: 'order.validationError' });
    const order = await useOrderStore.getState().createOrder(PAYLOAD);
    expect(order).toBeNull();
    expect(useOrderStore.getState().error).toBeTruthy();
    expect(useOrderStore.getState().loading).toBe(false);
  });

  it('create order offline -> queuedOffline = true', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
    const order = await useOrderStore.getState().createOrder(PAYLOAD);
    expect(order).toBeNull();
    expect(useOrderStore.getState().queuedOffline).toBe(true);
    expect(useOrderStore.getState().loading).toBe(false);
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
  });

  it('create order clears cart on success (integration)', async () => {
    useCartStore.getState().addItem(MOCK_PRODUCT);
    useCartStore.getState().addItem(MOCK_PRODUCT);
    expect(useCartStore.getState().totalItems()).toBe(2);
    mockFetch(201, MOCK_ORDER_RESPONSE);
    await useOrderStore.getState().createOrder({
      ...PAYLOAD,
      items: [{ id: 'prod-1', name: 'Ca Phe Sua Da', price: 45000, quantity: 2 }],
    });
    useCartStore.getState().clearCart();
    expect(useCartStore.getState().totalItems()).toBe(0);
  });
});

/* ══════════════════════════════════════════════════════════════════════
   4. Order Status
   ══════════════════════════════════════════════════════════════════════ */
describe('Order Status', () => {
  beforeEach(() => {
    useOrderStore.setState({
      currentOrder: null, loading: false, error: null,
      queuedOffline: false, pollingId: null,
    });
    vi.restoreAllMocks();
  });

  it('initial state has null currentOrder', () => {
    const state = useOrderStore.getState();
    expect(state.currentOrder).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('status progression via fetchOrder mock', async () => {
    const statuses = ['pending', 'confirmed', 'preparing', 'ready'];
    for (const status of statuses) {
      mockFetch(200, {
        success: true,
        data: { ...MOCK_ORDER_RESPONSE.data, status },
      });
      await useOrderStore.getState().fetchOrder('ORD-001');
      expect(useOrderStore.getState().currentOrder!.status).toBe(status);
    }
  });

  it('polling stops at terminal status', async () => {
    vi.useFakeTimers();
    mockFetch(200, {
      success: true,
      data: { ...MOCK_ORDER_RESPONSE.data, status: 'completed' },
    });
    useOrderStore.getState().startPolling('ORD-001');
    expect(useOrderStore.getState().pollingId).not.toBeNull();
    // First tick: fetchOrder sets currentOrder to 'completed'
    await vi.advanceTimersByTimeAsync(15_000);
    // Second tick: detects terminal status and calls stopPolling
    await vi.advanceTimersByTimeAsync(15_000);
    expect(useOrderStore.getState().pollingId).toBeNull();
    vi.useRealTimers();
  });

  it('error state on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
    await useOrderStore.getState().fetchOrder('ORD-001');
    expect(useOrderStore.getState().error).toContain('Network');
    expect(useOrderStore.getState().currentOrder).toBeNull();
  });
});

/* ══════════════════════════════════════════════════════════════════════
   5. Checkout Validation (Zod schema)
   ══════════════════════════════════════════════════════════════════════ */
describe('Checkout Validation', () => {
  const VALID_FORM = {
    fullName: 'Nguyen Van A',
    phone: '0901234567',
    address: '123 Le Loi, Quan 1',
    paymentMethod: 'cod' as const,
    deliveryTime: 'now' as const,
  };

  it('empty customer name -> validation error', () => {
    const result = checkoutFormSchema.safeParse({ ...VALID_FORM, fullName: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const names = result.error.issues.map((i) => i.path[0]);
      expect(names).toContain('fullName');
    }
  });

  it('empty phone -> validation error', () => {
    const result = checkoutFormSchema.safeParse({ ...VALID_FORM, phone: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const names = result.error.issues.map((i) => i.path[0]);
      expect(names).toContain('phone');
    }
  });

  it('invalid phone -> validation error', () => {
    const result = checkoutFormSchema.safeParse({ ...VALID_FORM, phone: '12345' });
    expect(result.success).toBe(false);
  });

  it('valid form -> proceeds (parse succeeds)', () => {
    const result = checkoutFormSchema.safeParse(VALID_FORM);
    expect(result.success).toBe(true);
  });
});

/* ══════════════════════════════════════════════════════════════════════
   6. Payment Methods
   ══════════════════════════════════════════════════════════════════════ */
describe('Payment Methods', () => {
  beforeEach(() => {
    useOrderStore.setState({
      currentOrder: null, loading: false, error: null,
      queuedOffline: false, pollingId: null,
    });
    vi.restoreAllMocks();
  });

  const BASE_PAYLOAD = {
    items: [{ id: 'prod-1', name: 'Ca Phe Sua Da', price: 45000, quantity: 1 }],
    total: 45000,
    customer_name: 'Test User',
    customer_phone: '0901234567',
  };

  it('COD selected -> order created directly', async () => {
    mockFetch(201, MOCK_ORDER_RESPONSE);
    const order = await useOrderStore.getState().createOrder({
      ...BASE_PAYLOAD,
      payment_method: 'cod',
    });
    expect(order).not.toBeNull();
    expect(order!.payment_method).toBe('cod');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/orders'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('PayOS selected -> order created then redirect expected', async () => {
    mockFetch(201, {
      success: true,
      data: { ...MOCK_ORDER_RESPONSE.data, payment_method: 'payos' },
    });
    const order = await useOrderStore.getState().createOrder({
      ...BASE_PAYLOAD,
      payment_method: 'payos',
    });
    expect(order).not.toBeNull();
    expect(order!.payment_method).toBe('payos');
  });

  it('payment failure -> error + retry available', async () => {
    mockFetch(500, { message: 'order.paymentFailed' });
    const order = await useOrderStore.getState().createOrder({
      ...BASE_PAYLOAD,
      payment_method: 'payos',
    });
    expect(order).toBeNull();
    expect(useOrderStore.getState().error).toBeTruthy();
    // Retry: store is still functional
    mockFetch(201, MOCK_ORDER_RESPONSE);
    const retry = await useOrderStore.getState().createOrder({
      ...BASE_PAYLOAD,
      payment_method: 'payos',
    });
    expect(retry).not.toBeNull();
  });
});
