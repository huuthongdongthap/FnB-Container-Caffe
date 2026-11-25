import { createElement, type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useKDS } from '@/hooks/use-kds';
import { useAuthStore, type AuthUser } from '@/hooks/stores/use-auth-store';
import { apiFetch } from '@/lib/api-client';
import { consumeKdsStream } from '@/hooks/kds-stream';

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn(), API_BASE: 'https://test-api.example.com' }));
vi.mock('@/hooks/kds-stream', () => ({ consumeKdsStream: vi.fn(async () => {}) }));
const staff: AuthUser = { id: 'staff-a', name: 'Staff A', email: 'a@test.aura', role: 'staff', tenantId: 'cafe-a' };
const ticket = { id: 'ORD_1', status: 'ready', items: [{ name: 'Coffee', quantity: 1 }] };
let client: QueryClient;
function setup(station = 'all') {
  return renderHook(() => useKDS(station), {
    wrapper: ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children),
  });
}

describe('useKDS authoritative session cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    useAuthStore.setState({ user: staff, sessionVersion: 0 });
    vi.mocked(apiFetch).mockResolvedValue({ data: [ticket] });
  });
  afterEach(() => { cleanup(); client.clear(); useAuthStore.setState({ user: null }); });

  it('fetches the active queue with a cancellable request', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.orders[0]?.id).toBe('ORD_1'));
    expect(apiFetch).toHaveBeenCalledWith('/api/kds/orders', { signal: expect.any(AbortSignal) });
  });
  it('filters by station and subscribes to station-scoped SSE stream', async () => {
    const { result } = setup('drinks');
    await waitFor(() => expect(result.current.orders).toHaveLength(1));
    expect(apiFetch).toHaveBeenCalledWith('/api/kds/orders?station=drinks', expect.any(Object));
    expect(consumeKdsStream).toHaveBeenCalledWith(expect.any(AbortSignal), expect.any(Function), 'drinks', expect.any(Function));
  });
  it('removes completed tickets absent from the next authoritative REST queue', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.orders).toHaveLength(1));
    vi.mocked(apiFetch).mockResolvedValue({ data: [] });
    await act(async () => { await client.invalidateQueries({ queryKey: ['kds-orders'] }); });
    await waitFor(() => expect(result.current.orders).toHaveLength(0));
  });
  it('replaces snapshot data, including removed ready tickets', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.orders).toHaveLength(1));
    const [, snapshot] = vi.mocked(consumeKdsStream).mock.calls[0]!;
    act(() => snapshot([]));
    await waitFor(() => expect(result.current.orders).toHaveLength(0));
  });
  it('prunes expired cancelled alerts when subsequent SSE snapshot omits them', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      data: [
        ticket,
        {
          id: 'ORD_CANCELLED',
          status: 'cancelled',
          cancel_alert: true,
          items: [{ name: 'Tea', quantity: 1 }],
        },
      ],
    });
    const { result } = setup();
    await waitFor(() => expect(result.current.orders.map(o => o.id)).toEqual(['ORD_1', 'ORD_CANCELLED']));
    const [, snapshot] = vi.mocked(consumeKdsStream).mock.calls[0]!;
    act(() =>
      snapshot([
        {
          id: 'ORD_1',
          status: 'ready',
          items: [{ product_name: 'Coffee', quantity: 1 }],
          created_at: new Date().toISOString(),
        },
      ]),
    );
    await waitFor(() => expect(result.current.orders.map(o => o.id)).toEqual(['ORD_1']));
  });
  it('aborts old stream, removes private cache and isolates a different actor/tenant', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.orders).toHaveLength(1));
    const [oldSignal, oldSnapshot] = vi.mocked(consumeKdsStream).mock.calls[0]!;
    let resolveNext!: (value: unknown) => void;
    vi.mocked(apiFetch).mockImplementation(() => new Promise(resolve => { resolveNext = resolve; }));
    act(() => useAuthStore.setState({ user: { ...staff, id: 'staff-b', tenantId: 'cafe-b' }, sessionVersion: 1 }));
    expect(result.current.orders).toHaveLength(0);
    expect(oldSignal.aborted).toBe(true);
    act(() => oldSnapshot([ticket]));
    expect(result.current.orders).toHaveLength(0);
    expect(client.getQueryCache().findAll({ queryKey: ['kds-orders', '0:staff-a:cafe-a:staff'] })).toHaveLength(0);
    await act(async () => resolveNext({ data: [{ ...ticket, id: 'ORD_B' }] }));
    await waitFor(() => expect(result.current.orders[0]?.id).toBe('ORD_B'));
  });
  it('does not fetch or display private tickets after logout', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.orders).toHaveLength(1));
    act(() => useAuthStore.setState({ user: null, sessionVersion: 1 }));
    expect(result.current.orders).toHaveLength(0);
    expect(vi.mocked(consumeKdsStream).mock.calls[0]?.[0].aborted).toBe(true);
  });
  it('reports PATCH failures per order, preserves status, and permits retry', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.orders).toHaveLength(1));
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('403 forbidden'));
    act(() => result.current.updateStatus('ORD_1', 'served'));
    await waitFor(() => expect(result.current.mutationErrors.ORD_1).toBe('403 forbidden'));
    expect(result.current.orders[0]?.status).toBe('ready');
    expect(result.current.pendingOrders.ORD_1).toBe(false);
    vi.mocked(apiFetch).mockResolvedValue({ data: [] });
    act(() => result.current.updateStatus('ORD_1', 'served'));
    await waitFor(() => expect(result.current.orders).toHaveLength(0));
    expect(result.current.mutationErrors.ORD_1).toBeUndefined();
  });

  it('blocks duplicate transitions synchronously while an order is pending', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.orders).toHaveLength(1));
    let finish!: (value: unknown) => void;
    vi.mocked(apiFetch).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    act(() => {
      result.current.updateStatus('ORD_1', 'served');
      result.current.updateStatus('ORD_1', 'served');
    });
    await waitFor(() => expect(result.current.pendingOrders.ORD_1).toBe(true));
    expect(vi.mocked(apiFetch).mock.calls.filter(([url]) => url.includes('/status'))).toHaveLength(1);
    vi.mocked(apiFetch).mockResolvedValue({ data: [] });
    await act(async () => finish({ success: true }));
    await waitFor(() => expect(result.current.pendingOrders.ORD_1).toBe(false));
  });

  it('does not complete an order after a failed ready transition', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.orders).toHaveLength(1));
    vi.mocked(apiFetch).mockRejectedValue(new Error('409 conflict'));
    act(() => result.current.completeOrder('ORD_1'));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/orders/ORD_1/status', expect.objectContaining({ method: 'PATCH' })));
    expect(vi.mocked(apiFetch).mock.calls.some(([url]) => url.includes('/complete'))).toBe(false);
  });
});
