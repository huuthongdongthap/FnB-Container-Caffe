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

export function useAdmin(): AdminResult {
  const {
    data: stats,
    isLoading: isLoadingStats,
    error: statsError,
  } = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: () => apiFetch<AdminStats>('/api/stats'),
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  const {
    data: orders = [],
    isLoading: isLoadingOrders,
    error: ordersError,
  } = useQuery<AdminOrder[]>({
    queryKey: ['admin-orders'],
    queryFn: () =>
      apiFetch<{ orders: AdminOrder[] }>('/api/admin/orders').then((r) => r.orders),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const {
    data: customers = [],
    isLoading: isLoadingCustomers,
  } = useQuery<AdminCustomer[]>({
    queryKey: ['admin-customers'],
    queryFn: () =>
      apiFetch<{ customers: AdminCustomer[] }>('/api/admin/customers').then((r) => r.customers),
    staleTime: 60_000,
  });

  const {
    data: syncStatus,
    isLoading: isLoadingSyncStatus,
  } = useQuery<SyncStatusInfo>({
    queryKey: ['admin-sync-status'],
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
