import { useQuery } from '@tanstack/react-query';
import { apiFetch, API_BASE } from '@/lib/api-client';
import { getAuthHeaders } from '@/hooks/stores/admin/admin-utils';
import { useClientSessionScope } from '@/lib/client-session';

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
  const session = useClientSessionScope();
  return useQuery<TopProduct[]>({
    queryKey: ['analytics', 'top-products', session.tenantId, session.userScope, limit],
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
  const session = useClientSessionScope();
  return useQuery<PeakHour[]>({
    queryKey: ['analytics', 'peak-hours', session.tenantId, session.userScope, days],
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
  const session = useClientSessionScope();
  return useQuery<CustomerMetricsData>({
    queryKey: ['analytics', 'customer-metrics', session.tenantId, session.userScope],
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
  const session = useClientSessionScope();
  return useQuery<ZoneRow[]>({
    queryKey: ['analytics', 'zones', session.tenantId, session.userScope, days],
    queryFn: async () => {
      const res = await apiFetch<ApiSuccess<ZoneRow[]>>(`/api/analytics/zones?days=${days}`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

const ICT_OFFSET_MS = 7 * 3600_000;

export function toStoreDateString(nowMs = Date.now()): string {
  return new Date(nowMs + ICT_OFFSET_MS).toISOString().slice(0, 10);
}

export function resolveDailyRevenueRange(from?: string, to?: string): { start: string; end: string } {
  const nowMs = Date.now();
  const shorthandMatch = from && !to ? /^(\d+)d$/i.exec(from.trim()) : null;
  if (shorthandMatch) {
    const days = Math.max(1, Number(shorthandMatch[1]));
    return {
      start: toStoreDateString(nowMs - (days - 1) * 86400_000),
      end: toStoreDateString(nowMs),
    };
  }
  const end = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : toStoreDateString(nowMs);
  const start =
    from && /^\d{4}-\d{2}-\d{2}$/.test(from)
      ? from
      : toStoreDateString(nowMs - 30 * 86400_000);
  return { start, end };
}

/**
 * Daily revenue report for date range
 * GET /api/reports/daily?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export function useDailyRevenue(from?: string, to?: string) {
  const session = useClientSessionScope();
  const { start, end } = resolveDailyRevenueRange(from, to);

  return useQuery<DailyRevenueRow[]>({
    queryKey: ['reports', 'daily', session.tenantId, session.userScope, start, end],
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
  const res = await fetch(
    `${API_BASE}/api/analytics/export?type=revenue&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    {
      credentials: 'include',
      headers: getAuthHeaders(),
    },
  );
  if (!res.ok) {
    throw new Error(`CSV export failed (${res.status})`);
  }
  const text = await res.text();
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `analytics-export-${start}-to-${end}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
