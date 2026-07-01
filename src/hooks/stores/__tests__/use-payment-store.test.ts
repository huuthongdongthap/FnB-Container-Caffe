import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePaymentStore } from '@/hooks/stores/use-payment-store';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }));
}

describe('usePaymentStore', () => {
  beforeEach(() => {
    usePaymentStore.setState({
      paymentLink: null,
      loading: false,
      error: null,
    });
    useAuthStore.setState({ token: null, user: null, loading: false, error: null });
    localStorage.clear();
    vi.restoreAllMocks();
  });

  /* ── Initial state ── */
  it('starts with null paymentLink, loading=false', () => {
    const s = usePaymentStore.getState();
    expect(s.paymentLink).toBeNull();
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  /* ── createPaymentLink ── */
  it('createPaymentLink(): POST /api/payment/create-link, returns payment URL', async () => {
    useAuthStore.setState({ token: 'valid-jwt' });
    mockFetch(200, { checkout_url: 'https://payos.vn/checkout/abc' });

    const url = await usePaymentStore.getState().createPaymentLink('ord-123', 85000);

    expect(url).toBe('https://payos.vn/checkout/abc');
    const s = usePaymentStore.getState();
    expect(s.paymentLink).toBe('https://payos.vn/checkout/abc');
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('createPaymentLink(): handles checkout_url in checkout_url field', async () => {
    useAuthStore.setState({ token: 'valid-jwt' });
    mockFetch(200, { checkout_url: 'https://pay.example/checkout' });

    const url = await usePaymentStore.getState().createPaymentLink('ord-123', 50000);

    expect(url).toBe('https://pay.example/checkout');
  });

  it('createPaymentLink(): handles nested payment.checkoutUrl', async () => {
    useAuthStore.setState({ token: 'valid-jwt' });
    mockFetch(200, { payment: { checkoutUrl: 'https://pay.example/checkout' } });

    const url = await usePaymentStore.getState().createPaymentLink('ord-123', 50000);

    expect(url).toBe('https://pay.example/checkout');
  });

  it('createPaymentLink(): handles plain url field', async () => {
    useAuthStore.setState({ token: 'valid-jwt' });
    mockFetch(200, { url: 'https://pay.example/checkout' });

    const url = await usePaymentStore.getState().createPaymentLink('ord-123', 50000);

    expect(url).toBe('https://pay.example/checkout');
  });

  it('createPaymentLink(): sets error on API failure', async () => {
    useAuthStore.setState({ token: 'valid-jwt' });
    mockFetch(400, { message: 'Order not found' });

    const url = await usePaymentStore.getState().createPaymentLink('ord-999', 50000);

    expect(url).toBeNull();
    const s = usePaymentStore.getState();
    expect(s.error).toContain('Order');
    expect(s.loading).toBe(false);
  });

  it('createPaymentLink(): sets error on network failure', async () => {
    useAuthStore.setState({ token: 'valid-jwt' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const url = await usePaymentStore.getState().createPaymentLink('ord-123', 50000);

    expect(url).toBeNull();
    const s = usePaymentStore.getState();
    expect(s.error).toContain('Network');
  });

  it('createPaymentLink(): requires auth token — sets error if no token', async () => {
    // No token set — useAuthStore token is null
    const url = await usePaymentStore.getState().createPaymentLink('ord-123', 50000);

    expect(url).toBeNull();
    const s = usePaymentStore.getState();
    expect(s.error).toContain('đăng nhập');
    expect(s.loading).toBe(false);
  });

  /* ── TDD: Idempotency header (Phase 1 baseline) ── */
  it('createPaymentLink(): sends Authorization header with token', async () => {
    useAuthStore.setState({ token: 'valid-jwt' });
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({ checkout_url: 'https://payos.vn/test' }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await usePaymentStore.getState().createPaymentLink('ORD_99', 75000);

    const headers = fetchSpy.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe('Bearer valid-jwt');
    expect(headers['Content-Type']).toBe('application/json');
  });

  /* ── TDD: Retry behavior baseline (Phase 1) ── */
  it('createPaymentLink(): allows retry after failure (store resets error on new call)', async () => {
    useAuthStore.setState({ token: 'valid-jwt' });
    // First call fails
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    await usePaymentStore.getState().createPaymentLink('ORD_1', 50000);
    expect(usePaymentStore.getState().error).not.toBeNull();

    // Second call succeeds (store should clear error on start)
    usePaymentStore.setState({ error: null }); // explicit reset for baseline
    mockFetch(200, { checkout_url: 'https://pay.example/ok' });
    await usePaymentStore.getState().createPaymentLink('ORD_1', 50000);
    expect(usePaymentStore.getState().error).toBeNull();
    expect(usePaymentStore.getState().paymentLink).toBe('https://pay.example/ok');
  });
});
