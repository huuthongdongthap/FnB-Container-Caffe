import { useQuery } from '@tanstack/react-query';
import { apiFetch, API_BASE } from '@/lib/api-client';

// ── Types ──
export interface DailyReport {
  date: string;
  orders: number;
  revenue: number;
  signups: number;
  cashback_earned: number;
  cashback_redeemed: number;
  avg_order_value: number;
}

export interface TopProduct {
  name: string;
  qty: number;
  revenue: number;
}

export interface PeakHour {
  hour: number;
  order_count: number;
  revenue: number;
}

export interface CustomerMetricsData {
  total_customers: number;
  new_customers_30d: number;
  repeat_customers: number;
  repeat_rate: number;
  avg_spend_per_customer: number;
  avg_orders_per_customer: number;
}

// ── Daily Report ──
export function useDailyReport(from: string, to: string) {
  return useQuery<DailyReport[]>({
    queryKey: ['reports', 'daily', from, to],
    queryFn: async () => {
      const res = await apiFetch<{ success?: boolean; data?: DailyReport[] } | DailyReport[]>(
        `/api/reports/daily?from=${from}&to=${to}`,
      );
      return Array.isArray(res) ? res : (res?.data ?? []);
    },
    enabled: !!from && !!to,
    staleTime: 60_000,
  });
}

// ── Top Products ──
export function useTopProducts(from: string, to: string, limit = 10) {
  return useQuery<TopProduct[]>({
    queryKey: ['reports', 'top-products', from, to, limit],
    queryFn: async () => {
      const res = await apiFetch<{ success?: boolean; data?: TopProduct[] } | TopProduct[]>(
        `/api/reports/top-products?from=${from}&to=${to}&limit=${limit}`,
      );
      return Array.isArray(res) ? res : (res?.data ?? []);
    },
    enabled: !!from && !!to,
    staleTime: 60_000,
  });
}

// ── Peak Hours ──
export function usePeakHours(from: string, to: string) {
  return useQuery<PeakHour[]>({
    queryKey: ['reports', 'peak-hours', from, to],
    queryFn: async () => {
      const res = await apiFetch<{ success?: boolean; data?: PeakHour[] } | PeakHour[]>(
        `/api/reports/peak-hours?from=${from}&to=${to}`,
      );
      return Array.isArray(res) ? res : (res?.data ?? []);
    },
    enabled: !!from && !!to,
    staleTime: 60_000,
  });
}

// ── Customer Metrics ──
export function useCustomerMetrics() {
  return useQuery<CustomerMetricsData>({
    queryKey: ['reports', 'customer-metrics'],
    queryFn: async () => {
      const res = await apiFetch<{ success?: boolean; data?: CustomerMetricsData } | CustomerMetricsData>(
        '/api/reports/customer-metrics',
      );
      return (res as { data?: CustomerMetricsData })?.data ?? (res as CustomerMetricsData);
    },
    staleTime: 60_000,
  });
}

// ── Export URL (for direct download links) ──
export function getExportUrl(type: string, from: string, to: string): string {
  return `${API_BASE}/api/reports/export?from=${from}&to=${to}&type=${type}`;
}
