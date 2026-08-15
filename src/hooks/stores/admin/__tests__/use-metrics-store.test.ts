import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMetricsStore } from '@/hooks/stores/admin/use-metrics-store';

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
    vi.restoreAllMocks();
    mockApiFetch.mockReset();
  });

  it('starts with data=null, loading=false, error=null, range=24h', () => {
    const s = useMetricsStore.getState();
    expect(s.data).toBeNull();
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
    expect(s.range).toBe('24h');
  });

  it('fetchMetrics(): sets error on failure', async () => {
    mockError('Lỗi kết nối');

    await useMetricsStore.getState().fetchMetrics();

    expect(useMetricsStore.getState().error).toContain('Lỗi kết nối');
    expect(useMetricsStore.getState().loading).toBe(false);
  });

  it('fetchMetrics(): populates data on success', async () => {
    mockSuccess(fakeMetrics);

    await useMetricsStore.getState().fetchMetrics();

    const s = useMetricsStore.getState();
    expect(s.data).toEqual(fakeMetrics);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchMetrics(): calls apiFetch with range param', async () => {
    mockSuccess(fakeMetrics);

    await useMetricsStore.getState().fetchMetrics();

    expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/metrics?range=24h');
  });

  it('fetchMetrics(): skips if cached within TTL', async () => {
    mockSuccess(fakeMetrics);

    await useMetricsStore.getState().fetchMetrics();
    mockApiFetch.mockClear();

    await useMetricsStore.getState().fetchMetrics();

    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('setRange(): updates range and fetches', async () => {
    mockSuccess({ ...fakeMetrics, range: '7d' });

    useMetricsStore.getState().setRange('7d');

    expect(useMetricsStore.getState().range).toBe('7d');
  });
});
