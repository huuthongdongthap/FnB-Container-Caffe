import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, createTestAuthState } from '@/test-utils';
import MetricsDashboardPage from '@/pages/admin/Metrics';
import { useMetricsStore } from '@/hooks/stores/admin/use-metrics-store';

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

describe('MetricsDashboard', () => {
  beforeEach(() => {
    useMetricsStore.setState({
      data: null,
      loading: false,
      error: null,
      range: '24h',
      lastFetched: {},
    });
    // Default mock fetch — prevent real network calls from useEffect
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(fakeMetrics),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders page title', () => {
    createTestAuthState('test-jwt', { id: '1', name: 'Admin', email: 'admin@aura.vn', role: 'owner' });
    renderWithProviders(<MetricsDashboardPage />);
    expect(screen.getByText('Metrics Dashboard')).toBeTruthy();
  });

  it('renders range selector with 3 tabs', () => {
    createTestAuthState('test-jwt', { id: '1', name: 'Admin', email: 'admin@aura.vn', role: 'owner' });
    renderWithProviders(<MetricsDashboardPage />);
    expect(screen.getByText('24 Hours')).toBeTruthy();
    expect(screen.getByText('7 Days')).toBeTruthy();
    expect(screen.getByText('30 Days')).toBeTruthy();
  });

  it('shows loading skeletons when data is null and loading=true', async () => {
    createTestAuthState('test-jwt', { id: '1', name: 'Admin', email: 'admin@aura.vn', role: 'owner' });
    // Use a never-resolving promise so loading stays true
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise(() => {})));
    useMetricsStore.setState({ data: null, loading: true });
    renderWithProviders(<MetricsDashboardPage />);
    // Skeleton cards should be visible
    await waitFor(() => {
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  it('renders metric cards with data when loaded', () => {
    createTestAuthState('test-jwt', { id: '1', name: 'Admin', email: 'admin@aura.vn', role: 'owner' });
    useMetricsStore.setState({ data: fakeMetrics, loading: false });
    renderWithProviders(<MetricsDashboardPage />);
    // Metric labels
    expect(screen.getByText('Orders')).toBeTruthy();
    expect(screen.getByText('Revenue')).toBeTruthy();
    expect(screen.getByText('Success Rate')).toBeTruthy();
    expect(screen.getByText('Latency')).toBeTruthy();
  });

  it('renders request chart with top paths', () => {
    createTestAuthState('test-jwt', { id: '1', name: 'Admin', email: 'admin@aura.vn', role: 'owner' });
    useMetricsStore.setState({ data: fakeMetrics, loading: false });
    renderWithProviders(<MetricsDashboardPage />);
    expect(screen.getByText('Top Request Paths')).toBeTruthy();
    expect(screen.getByText('/api/menu')).toBeTruthy();
    expect(screen.getByText('/api/orders')).toBeTruthy();
  });

  it('shows error banner on fetch failure', async () => {
    createTestAuthState('test-jwt', { id: '1', name: 'Admin', email: 'admin@aura.vn', role: 'owner' });
    // Mock fetch to avoid useEffect overwriting the error
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server error' }),
    }));
    renderWithProviders(<MetricsDashboardPage />);
    // Wait for the failed fetch to set the error
    await waitFor(() => {
      expect(screen.getAllByText(/Request failed: 500/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('calls fetchMetrics on mount', () => {
    createTestAuthState('test-jwt', { id: '1', name: 'Admin', email: 'admin@aura.vn', role: 'owner' });
    const fetchSpy = vi.spyOn(useMetricsStore.getState(), 'fetchMetrics');
    renderWithProviders(<MetricsDashboardPage />);
    expect(fetchSpy).toHaveBeenCalled();
  });
});
