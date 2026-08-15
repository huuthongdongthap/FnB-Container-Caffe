import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

/* ─── Types matching backend analytics endpoints ─── */

export interface TopProduct {
  product_name: string;
  total_qty: number;
  revenue: number;
}

export interface PeakHour {
  hour: number;
  order_count: number;
  revenue: number;
}

export interface CustomerMetricsData {
  total_customers: number;
  new_30d: number;
  repeat_rate: number;
  avg_order_value: number;
}

export interface ZoneRow {
  label: string;
  value: number;
  count: number;
}

export interface DailyRevenueRow {
  date: string;
  revenue: number;
  orders: number;
  signups: number;
  cashback_earned: number;
  cashback_redeemed: number;
  avg_order_value: number;
}

/* ─── API response wrappers ─── */

interface ApiSuccess<T> {
  success: true;
  data: T;
}

interface CustomerMetricsResponse {
  success: boolean;
  data: CustomerMetricsData;
}

/* ─── Hooks ─── */

/**
 * Top N products by order count + revenue
 * GET /api/analytics/top-products?limit=N
 */
export function useTopProducts(limit = 10) {
  return useQuery<TopProduct[]>({
    queryKey: ['analytics', 'top-products', limit],
    queryFn: async () => {
      const res = await apiFetch<ApiSuccess<TopProduct[]>>(
        `/api/analytics/top-products?limit=${limit}`,
      );
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Orders grouped by hour of day (zero-filled 24h array)
 * GET /api/analytics/peak-hours?days=N
 */
export function usePeakHours(days = 30) {
  return useQuery<PeakHour[]>({
    queryKey: ['analytics', 'peak-hours', days],
    queryFn: async () => {
      const res = await apiFetch<ApiSuccess<PeakHour[]>>(
        `/api/analytics/peak-hours?days=${days}`,
      );
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Aggregate customer metrics
 * GET /api/analytics/customer-metrics
 */
export function useCustomerMetrics() {
  return useQuery<CustomerMetricsData>({
    queryKey: ['analytics', 'customer-metrics'],
    queryFn: async () => {
      const res = await apiFetch<CustomerMetricsResponse>(
        '/api/analytics/customer-metrics',
      );
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Revenue + order count grouped by physical zone (Indoor/Outdoor/VIP/etc.)
 * GET /api/analytics/zones?days=N
 */
export function useZoneStats(days = 30) {
  return useQuery<ZoneRow[]>({
    queryKey: ['analytics', 'zones', days],
    queryFn: async () => {
      const res = await apiFetch<ApiSuccess<ZoneRow[]>>(`/api/analytics/zones?days=${days}`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Daily revenue report for date range
 * GET /api/reports/daily?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export function useDailyRevenue(from?: string, to?: string) {
  const end = to || new Date().toISOString().slice(0, 10);
  const start = from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  return useQuery<DailyRevenueRow[]>({
    queryKey: ['reports', 'daily', start, end],
    queryFn: async () => {
      const res = await apiFetch<ApiSuccess<DailyRevenueRow[]>>(
        `/api/reports/daily?from=${start}&to=${end}`,
      );
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Trigger CSV download from the analytics export endpoint.
 * GET /api/analytics/export?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Returns a Blob and triggers browser download.
 */
export async function downloadAnalyticsCsv(start: string, end: string): Promise<void> {
  const res = await apiFetch<{ success: boolean; data: Blob }>(
    `/api/analytics/export?start=${start}&end=${end}`,
  );

  const blob = res.data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `analytics-export-${start}-to-${end}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
