import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckoutPage } from '../checkout';
import { clearCheckoutIntent } from '../checkout-intent';
import { useOrderStore } from '@/hooks/stores/use-order-store';
import { usePaymentStore } from '@/hooks/stores/use-payment-store';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import type { CheckoutNewFormData } from '@/components/stitch/StitchCheckoutNew';

const mock = vi.hoisted(() => ({ api: vi.fn(), navigate: vi.fn(), pay: vi.fn(), clear: vi.fn(),
  submit: null as null | ((form: any) => Promise<void>),
  cart: { items: [{ id: 'coffee', productId: 'coffee', name: 'Coffee', price: 20000, quantity: 1 }], totalItems: 1, subtotal: 20000 } }));
vi.mock('@/lib/api-client', () => ({ apiFetch: (...args: unknown[]) => mock.api(...args), API_BASE: 'https://test.aura' }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mock.navigate, useSearchParams: () => [new URLSearchParams()] }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }) }));
vi.mock('@/components/seo/HelmetHead', () => ({ HelmetHead: () => null }));
vi.mock('@/components/stitch/StitchCheckoutNew', () => ({ StitchCheckoutNew: ({ onPlaceOrder }: any) => { mock.submit = onPlaceOrder; return null; } }));
vi.mock('@/hooks/use-cart', () => ({ useCart: () => ({ ...mock.cart, deliveryFee: 15000, qualifiesForFreeDelivery: false,
  clearCart: mock.clear, updateQuantity: vi.fn(), removeItem: vi.fn() }) }));

const form = { fullName: 'Local Customer', phone: '0901234567', address: '', tableNumber: '', notes: '',
  orderType: 'takeaway', paymentMethod: 'payos' } as CheckoutNewFormData;
let orders: Map<string, any>;
let loseResponse = false;
async function submit(data = form) {
  let error: unknown;
  await act(async () => { try { await mock.submit!(data); } catch (caught) { error = caught; } });
  return error;
}
const creates = () => mock.api.mock.calls.filter(([path, options]) => path === '/api/orders' && options?.method === 'POST');

beforeEach(() => {
  clearCheckoutIntent(); sessionStorage.clear(); localStorage.clear(); mock.api.mockReset(); mock.pay.mockReset(); mock.clear.mockReset();
  mock.navigate.mockReset(); orders = new Map(); loseResponse = false;
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  useAuthStore.setState({ user: null }); useOrderStore.setState({ currentOrder: null, error: null, queuedOffline: false });
  usePaymentStore.setState({ error: null, retryCreatePaymentLink: mock.pay });
  mock.pay.mockImplementation(async () => { usePaymentStore.setState({ error: 'Provider unavailable' }); return null; });
  mock.api.mockImplementation(async (path, options) => {
    if (path === '/api/orders' && options?.method === 'POST') {
      const key = options.headers?.['Idempotency-Key'];
      if (!key) throw new Error('Missing Idempotency-Key');
      if (!orders.has(key)) orders.set(key, { id: `ORDER_${orders.size + 1}`, totalAmount: 20000, paymentStatus: 'unpaid' });
      if (loseResponse) { loseResponse = false; throw new Error('Response lost after server commit'); }
      return { data: orders.get(key) };
    }
    if (String(path).endsWith('/track')) return { data: [...orders.values()].find((order) => String(path).includes(order.id)) };
    throw new Error(`Unexpected API request: ${path}`);
  });
});
afterEach(() => { cleanup(); clearCheckoutIntent(); });

describe('Checkout submit retries use one durable order intent', () => {
  it('retries a lost create response with the same idempotency key and receives the original order', async () => {
    loseResponse = true; render(<CheckoutPage />);
    expect(String(await submit())).toContain('Response lost');
    expect(String(await submit())).toContain('Provider unavailable');
    expect(creates()).toHaveLength(2);
    expect(creates()[0]?.[1]?.headers?.['Idempotency-Key']).toBe(creates()[1]?.[1]?.headers?.['Idempotency-Key']);
    expect(orders.size).toBe(1); expect(mock.pay).toHaveBeenCalledWith('ORDER_1', 20000);
  });
  it('retries payment-link failure without creating another order, including after remount', async () => {
    const mounted = render(<CheckoutPage />); await submit(); mounted.unmount(); render(<CheckoutPage />);
    await submit(); expect(creates()).toHaveLength(1); expect(orders.size).toBe(1);
    expect(mock.pay.mock.calls).toEqual([['ORDER_1', 20000], ['ORDER_1', 20000]]);
  });
  it('creates a fresh intent when the customer edits checkout data', async () => {
    render(<CheckoutPage />); await submit(); await submit({ ...form, notes: 'No sugar' });
    expect(orders.size).toBe(2);
    expect(creates()[0]?.[1]?.headers?.['Idempotency-Key']).not.toBe(creates()[1]?.[1]?.headers?.['Idempotency-Key']);
  });
  it('does not reuse a pending order across signed user or tenant identities', async () => {
    render(<CheckoutPage />); await submit();
    useAuthStore.setState({ user: { id: 'CUSTOMER_B', tenantId: 'cafe-b', role: 'customer', name: 'B', email: 'b@test.aura' } });
    await submit(); expect(orders.size).toBe(2); expect(mock.pay.mock.calls[1]?.[0]).toBe('ORDER_2');
  });
  it('shows the previous paid order after a lost return, then permits a new purchase after acknowledgement', async () => {
    const mounted = render(<CheckoutPage />); await submit();
    const previous = [...orders.values()][0]; previous.paymentStatus = 'paid';
    await submit();
    expect(orders.size).toBe(1); expect(creates()).toHaveLength(1); expect(mock.pay).toHaveBeenCalledTimes(1);
    expect(mock.navigate).toHaveBeenCalledWith('/order-success?order_id=ORDER_1');
    mounted.unmount(); render(<CheckoutPage />); await submit();
    expect(orders.size).toBe(2); expect(mock.pay.mock.calls[1]?.[0]).toBe('ORDER_2');
  });
  it('clears an acknowledged COD intent so a subsequent purchase has a new key', async () => {
    const mounted = render(<CheckoutPage />); await submit({ ...form, paymentMethod: 'cod' });
    expect(mock.navigate).toHaveBeenCalledWith('/order-success?order_id=ORDER_1'); expect(mock.pay).not.toHaveBeenCalled();
    mounted.unmount(); render(<CheckoutPage />); await submit({ ...form, paymentMethod: 'cod' });
    expect(orders.size).toBe(2); expect(mock.clear).toHaveBeenCalledTimes(2);
  });
  it('stops before provider I/O when identity changes during order creation', async () => {
    const create = mock.api.getMockImplementation()!;
    mock.api.mockImplementationOnce(async (...args) => {
      const response = await create(...args);
      useAuthStore.setState({ user: { id: 'CUSTOMER_B', tenantId: 'cafe-b', role: 'customer', name: 'B', email: 'b@test.aura' } });
      return response;
    });
    render(<CheckoutPage />); expect(String(await submit())).toContain('Phiên đăng nhập đã thay đổi');
    expect(mock.pay).not.toHaveBeenCalled(); expect(orders.size).toBe(1);
  });
  it('does not redirect a previous identity after an in-flight payment-link response', async () => {
    mock.pay.mockImplementationOnce(async () => {
      useAuthStore.setState({ user: { id: 'CUSTOMER_B', tenantId: 'cafe-b', role: 'customer', name: 'B', email: 'b@test.aura' } });
      return 'https://pay.payos.vn/web/old-identity';
    });
    render(<CheckoutPage />); expect(String(await submit())).toContain('Phiên đăng nhập đã thay đổi');
    expect(mock.navigate).not.toHaveBeenCalled();
  });
  it('does not rotate a pending intent when its tracking probe fails', async () => {
    render(<CheckoutPage />); await submit();
    mock.api.mockImplementation(async () => { throw new Error('Tracking unavailable'); });
    await submit(); expect(creates()).toHaveLength(1); expect(mock.pay.mock.calls[1]?.[0]).toBe('ORDER_1');
  });
});
