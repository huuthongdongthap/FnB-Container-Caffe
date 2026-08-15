import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAdminDashboardStore } from '@/hooks/stores/admin/use-admin-dashboard-store';

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

describe('useAdminDashboardStore', () => {
  beforeEach(() => {
    useAdminDashboardStore.setState({ stats: null, loading: false, error: null });
    vi.restoreAllMocks();
    mockApiFetch.mockReset();
  });

  it('starts with null stats, loading=false, error=null', () => {
    const s = useAdminDashboardStore.getState();
    expect(s.stats).toBeNull();
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchDashboard(): populates stats on success', async () => {
    const fakeStats = {
      todayRevenue: 12500000,
      todayOrders: 42,
      avgOrderValue: 297619,
      activeCustomers: 18,
    };
    mockSuccess(fakeStats);

    await useAdminDashboardStore.getState().fetchDashboard();

    const s = useAdminDashboardStore.getState();
    expect(s.stats).toEqual(fakeStats);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchDashboard(): sets error on failure', async () => {
    mockError('Không thể tải thống kê');

    await useAdminDashboardStore.getState().fetchDashboard();

    expect(useAdminDashboardStore.getState().error).toContain('Không thể tải thống kê');
  });

  it('fetchDashboard(): calls apiFetch with correct path', async () => {
    mockSuccess({});

    await useAdminDashboardStore.getState().fetchDashboard();

    expect(mockApiFetch).toHaveBeenCalledWith('/api/stats');
  });
});
