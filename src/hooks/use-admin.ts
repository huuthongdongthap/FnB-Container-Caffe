import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export interface AdminStats {
  todayRevenue: number;
  todayOrders: number;
  avgOrderValue: number;
  activeCustomers: number;
}

export interface AdminOrder {
  id: string;
  customer: string;
  items: number;
  itemsList?: Array<{ name: string; quantity: number }>;
  total: number;
  status: string;
  payment: string;
  createdAt: string;
}

export interface AdminCustomer {
  id: string;
  name: string;
  phone: string;
  totalOrders: number;
  totalSpent: number;
  tier: string;
  lastVisit: string;
}

export interface SyncStatusInfo {
  lastSync: string | null;
  status: 'synced' | 'pending' | 'error';
  pendingItems: number;
  errorMessage?: string;
}

interface AdminResult {
  stats: AdminStats | undefined;
  isLoadingStats: boolean;
  statsError: Error | null;
  orders: AdminOrder[];
  isLoadingOrders: boolean;
  ordersError: Error | null;
  customers: AdminCustomer[];
  isLoadingCustomers: boolean;
  syncStatus: SyncStatusInfo | undefined;
  isLoadingSyncStatus: boolean;
}

export interface UseAdminOptions {
  enableStats?: boolean;
  enableOrders?: boolean;
  enableCustomers?: boolean;
  enableSyncStatus?: boolean;
}

export function useAdmin(options: UseAdminOptions = {}): AdminResult {
  const {
    enableStats = true,
    enableOrders = true,
    enableCustomers = true,
    enableSyncStatus = true,
  } = options;

  const {
    data: stats,
    isLoading: isLoadingStats,
    error: statsError,
  } = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    enabled: enableStats,
    queryFn: () =>
      apiFetch<AdminStats & { stats?: Record<string, unknown> }>('/api/stats').then((raw) => {
        if (typeof raw?.todayRevenue === 'number' && typeof raw?.todayOrders === 'number') {
          return raw;
        }
        const s = (raw?.stats ?? raw ?? {}) as Record<string, unknown>;
        const todayOrders = Number(s.todayOrders ?? s.orders_today ?? 0);
        const todayRevenue = Number(s.todayRevenue ?? s.revenue_today ?? 0);
        return {
          todayRevenue,
          todayOrders,
          avgOrderValue: Number(
            s.avgOrderValue ?? (todayOrders > 0 ? Math.round(todayRevenue / todayOrders) : 0),
          ),
          activeCustomers: Number(s.activeCustomers ?? s.active_subscribers ?? 0),
        };
      }),
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  const {
    data: orders = [],
    isLoading: isLoadingOrders,
    error: ordersError,
  } = useQuery<AdminOrder[]>({
    queryKey: ['admin-orders'],
    enabled: enableOrders,
    queryFn: () =>
      apiFetch<{ orders?: Array<Record<string, unknown>>; data?: Array<Record<string, unknown>> }>('/api/admin/orders').then(
        (r) =>
          (r.orders || r.data || []).map((raw: Record<string, unknown>) => {
            if (typeof raw?.customer === 'string' && typeof raw?.items === 'number' && typeof raw?.payment === 'string') {
              return raw as unknown as AdminOrder;
            }
            let itemCount = 0;
            if (typeof raw?.items === 'number') {
              itemCount = raw.items;
            } else if (Array.isArray(raw?.items)) {
              itemCount = raw.items.reduce(
                (sum: number, i: Record<string, unknown>) => sum + Number(i?.qty ?? i?.quantity ?? 1),
                0,
              );
            } else if (typeof raw?.items === 'string' && raw.items.trim()) {
              try {
                const parsed = JSON.parse(raw.items);
                if (Array.isArray(parsed)) {
                  itemCount = parsed.reduce(
                    (sum: number, i: Record<string, unknown>) => sum + Number(i?.qty ?? i?.quantity ?? 1),
                    0,
                  );
                }
              } catch {
                itemCount = 0;
              }
            }
            return {
              ...raw,
              id: String(raw?.id ?? ''),
              customer: String(raw?.customer ?? raw?.customer_name ?? 'Khách lẻ'),
              items: itemCount,
              total: Number(raw?.total ?? 0),
              status: String(raw?.status ?? 'pending'),
              payment: String(raw?.payment ?? raw?.payment_method ?? 'cash'),
              createdAt: String(raw?.createdAt ?? raw?.created_at ?? ''),
            } as AdminOrder;
          }),
      ),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const {
    data: customers = [],
    isLoading: isLoadingCustomers,
  } = useQuery<AdminCustomer[]>({
    queryKey: ['admin-customers'],
    enabled: enableCustomers,
    queryFn: () =>
      apiFetch<{ customers?: Array<Record<string, unknown>>; data?: Array<Record<string, unknown>> }>('/api/admin/customers').then(
        (r) =>
          (r.customers || r.data || []).map((raw: Record<string, unknown>) =>
            typeof raw?.totalOrders === 'number' && typeof raw?.totalSpent === 'number'
              ? (raw as unknown as AdminCustomer)
              : ({
                  ...raw,
                  id: String(raw?.id ?? ''),
                  name: String(raw?.name ?? ''),
                  phone: String(raw?.phone ?? ''),
                  tier: String(raw?.tier ?? 'bronze'),
                  totalOrders: Number(raw?.totalOrders ?? raw?.visit_count ?? 0),
                  totalSpent: Number(raw?.totalSpent ?? raw?.total_spent ?? 0),
                  lastVisit: String(raw?.lastVisit ?? raw?.updated_at ?? raw?.created_at ?? ''),
                } as AdminCustomer)
          )
      ),
    staleTime: 60_000,
  });

  const {
    data: syncStatus,
    isLoading: isLoadingSyncStatus,
  } = useQuery<SyncStatusInfo>({
    queryKey: ['admin-sync-status'],
    enabled: enableSyncStatus,
    queryFn: () => apiFetch<SyncStatusInfo>('/api/admin/erpnext-sync/status'),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return {
    stats,
    isLoadingStats,
    statsError: statsError as Error | null,
    orders,
    isLoadingOrders,
    ordersError: ordersError as Error | null,
    customers,
    isLoadingCustomers,
    syncStatus,
    isLoadingSyncStatus,
  };
}
