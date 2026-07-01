import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMetricsStore } from '@/hooks/stores/admin/use-metrics-store';
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

const fakeMetrics = {
  range: '24h',
  since: '2026-07-01T00:00:00.000Z',
  generated_at: '2026-07-01T12:00:00.000Z',
  requests: { total: 1000 },
  errors: { total: 50 },
  orders: { total: 42 },
  revenue: { total: 5000000 },
  latency: { p50: 120, p95: 450 },
  topPaths: [
    { path: '/api/menu', count: 300 },
    { path: '/api/orders', count: 200 },
  ],
};

describe('useMetricsStore', () => {
  beforeEach(() => {
    useMetricsStore.setState({
      data: null,
      loading: false,
      error: null,
      range: '24h',
      lastFetched: {},
    });
    setUnauthenticated();
    vi.restoreAllMocks();
  });

  it('starts with data=null, loading=false, error=null, range=24h', () => {
    const s = useMetricsStore.getState();
    expect(s.data).toBeNull();
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
    expect(s.range).toBe('24h');
  });

  it('fetchMetrics(): sets error when no token', async () => {
    await useMetricsStore.getState().fetchMetrics();

    expect(useMetricsStore.getState().error).toContain('Chưa đăng nhập');
    expect(useMetricsStore.getState().loading).toBe(false);
  });

  it('fetchMetrics(): populates data on success', async () => {
    setAuthenticated();
    mockFetch(200, fakeMetrics);

    await useMetricsStore.getState().fetchMetrics();

    const s = useMetricsStore.getState();
    expect(s.data).toEqual(fakeMetrics);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchMetrics(): sets error on 401 (logs out)', async () => {
    setAuthenticated();
    mockFetch(401, { message: 'Unauthorized' });

    await useMetricsStore.getState().fetchMetrics();

    expect(useMetricsStore.getState().error).toContain('Phiên đăng nhập');
    expect(useAuthStore.getState().token).toBeNull(); // logged out
  });

  it('fetchMetrics(): sets error on network failure', async () => {
    setAuthenticated();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    await useMetricsStore.getState().fetchMetrics();

    expect(useMetricsStore.getState().error).toContain('Network error');
    expect(useMetricsStore.getState().loading).toBe(false);
  });

  it('fetchMetrics(): sends Bearer token in Authorization header', async () => {
    setAuthenticated();
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(fakeMetrics),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await useMetricsStore.getState().fetchMetrics();

    const headers = fetchSpy.mock.calls[0]![1]?.headers as Record<string, string> | undefined;
    expect(headers?.Authorization).toContain('Bearer valid-token');
  });

  it('fetchMetrics(): does not refetch when same range is cached within TTL', async () => {
    setAuthenticated();
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(fakeMetrics),
    });
    vi.stubGlobal('fetch', fetchSpy);

    // First fetch — populates cache
    await useMetricsStore.getState().fetchMetrics();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Second fetch — should be cached
    await useMetricsStore.getState().fetchMetrics();
    expect(fetchSpy).toHaveBeenCalledTimes(1); // still 1
  });

  it('setRange(): changes range and triggers fetch', async () => {
    setAuthenticated();
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ...fakeMetrics, range: '7d' }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    useMetricsStore.getState().setRange('7d');

    expect(useMetricsStore.getState().range).toBe('7d');
    // fetchMetrics is called asynchronously by setRange
    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
  });
});
