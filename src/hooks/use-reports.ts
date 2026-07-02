import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

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
  return useQuery<{ success: boolean; data: DailyReport[] }>({
    queryKey: ['reports', 'daily', from, to],
    queryFn: () => apiFetch(`/api/reports/daily?from=${from}&to=${to}`),
    enabled: !!from && !!to,
    staleTime: 60_000,
  });
}

// ── Top Products ──
export function useTopProducts(from: string, to: string, limit = 10) {
  return useQuery<{ success: boolean; data: TopProduct[] }>({
    queryKey: ['reports', 'top-products', from, to, limit],
    queryFn: () => apiFetch(`/api/reports/top-products?from=${from}&to=${to}&limit=${limit}`),
    enabled: !!from && !!to,
    staleTime: 60_000,
  });
}

// ── Peak Hours ──
export function usePeakHours(from: string, to: string) {
  return useQuery<{ success: boolean; data: PeakHour[] }>({
    queryKey: ['reports', 'peak-hours', from, to],
    queryFn: () => apiFetch(`/api/reports/peak-hours?from=${from}&to=${to}`),
    enabled: !!from && !!to,
    staleTime: 60_000,
  });
}

// ── Customer Metrics ──
export function useCustomerMetrics() {
  return useQuery<{ success: boolean; data: CustomerMetricsData }>({
    queryKey: ['reports', 'customer-metrics'],
    queryFn: () => apiFetch('/api/reports/customer-metrics'),
    staleTime: 60_000,
  });
}

// ── Export URL (for direct download links) ──
const API_BASE =
  import.meta.env.VITE_API_BASE ||
  'https://aura-space-worker.agencyos-openclaw.workers.dev';

export function getExportUrl(type: string, from: string, to: string): string {
  return `${API_BASE}/api/reports/export?from=${from}&to=${to}&type=${type}`;
}
