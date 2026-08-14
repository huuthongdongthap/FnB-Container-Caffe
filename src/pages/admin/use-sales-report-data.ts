import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, API_BASE } from '@/lib/api-client';
import { previousPeriodDates } from './date-helpers';
import type { GroupedSalesData } from '@/components/admin/GroupedSalesChart';
import type { PeriodDataPoint } from './sales-report-types';

const COMPARISON_ERROR_KEY = '__COMPARISON_ERR__';
const CSV_EXPORT_ERR_KEY = '__CSV_EXPORT_ERR__';

export function useDailyReportData(from: string, to: string) {
  return useQuery<{ success: boolean; data: PeriodDataPoint[] }>({
    queryKey: ['reports', 'daily', from, to],
    queryFn: () => apiFetch(`/api/reports/daily?from=${from}&to=${to}`),
    enabled: !!from && !!to,
    staleTime: 60_000,
  });
}

export function useSalesGrouped(
  groupBy: 'hour' | 'day' | 'category' | 'payment',
  from: string,
  to: string,
) {
  const endpointMap: Record<string, string> = {
    hour: '/api/reports/sales-by-hour',
    day: '/api/reports/sales-by-day',
    category: '/api/reports/sales-by-category',
    payment: '/api/reports/sales-by-payment',
  };

  return useQuery<{ success: boolean; data: GroupedSalesData }>({
    queryKey: ['reports', 'sales-grouped', groupBy, from, to],
    queryFn: () => apiFetch(`${endpointMap[groupBy]}?from=${from}&to=${to}`),
    enabled: !!from && !!to,
    staleTime: 60_000,
  });
}

export function useComparisonData(from: string, to: string) {
  const prev = previousPeriodDates(from, to);
  const currentQ = useDailyReportData(from, to);
  const previousQ = useDailyReportData(prev.from, prev.to);

  return {
    data:
      currentQ.data?.data && previousQ.data?.data
        ? { current: currentQ.data.data, previous: previousQ.data.data }
        : null,
    loading: currentQ.isLoading || previousQ.isLoading,
    error: currentQ.error || previousQ.error ? COMPARISON_ERROR_KEY : null,
    refetch: () => { currentQ.refetch(); previousQ.refetch(); },
  };
}

export const CSV_EXPORT_ERR = CSV_EXPORT_ERR_KEY;

export function useExportCsv(from: string, to: string) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportCsv = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    setError(null);
    try {
      let token: string | null = null;
      try {
        const { useAuthStore } = await import('@/hooks/stores/use-auth-store');
        token = useAuthStore.getState().token;
      } catch { /* store not available */ }

      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/reports/export?from=${from}&to=${to}&type=sales`, { headers });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sales-report-${from}-to-${to}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : CSV_EXPORT_ERR_KEY);
    } finally {
      setExporting(false);
    }
  }, [from, to, exporting]);

  return { exportCsv, exporting, error };
}
