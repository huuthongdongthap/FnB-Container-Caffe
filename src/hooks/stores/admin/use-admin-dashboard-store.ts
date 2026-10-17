import { create } from 'zustand';
import type { AdminStats } from '@/hooks/use-admin';
import { apiFetch } from '@/lib/api-client';


interface AdminDashboardState {
  stats: AdminStats | null;
  loading: boolean;
  error: string | null;
  fetchDashboard: () => Promise<void>;
}

function normalizeDashboardStats(body: Record<string, unknown> | null | undefined): AdminStats {
  if (!body || typeof body !== 'object') {
    return { todayRevenue: 0, todayOrders: 0, avgOrderValue: 0, activeCustomers: 0 };
  }
  if (typeof body.todayRevenue === 'number' && typeof body.todayOrders === 'number') {
    return body as unknown as AdminStats;
  }
  const src = (body.stats && typeof body.stats === 'object' ? body.stats : body) as Record<string, unknown>;
  if (Object.keys(src).length === 0) {
    return body as unknown as AdminStats;
  }
  const todayRevenue = Number(src.todayRevenue ?? src.revenue_today ?? 0);
  const todayOrders = Number(src.todayOrders ?? src.orders_today ?? 0);
  const avgOrderValue =
    src.avgOrderValue !== undefined
      ? Number(src.avgOrderValue)
      : todayOrders > 0
        ? Math.round(todayRevenue / todayOrders)
        : 0;
  const activeCustomers = Number(src.activeCustomers ?? src.active_customers ?? todayOrders);
  return {
    todayRevenue,
    todayOrders,
    avgOrderValue,
    activeCustomers,
  };
}

export const useAdminDashboardStore = create<AdminDashboardState>((set) => ({
  stats: null,
  loading: false,
  error: null,

  fetchDashboard: async () => {
    set({ loading: true, error: null });
    try {
      const body = await apiFetch<any>('/api/stats');
      set({
        stats: normalizeDashboardStats(body),
        loading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      set({ loading: false, error: message });
    }
  },
}));
