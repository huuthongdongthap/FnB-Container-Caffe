---
phase: 3
title: "Frontend: Real Data Hooks + RevenueChart Wiring"
status: pending
priority: P1
effort: 1h
mode: tdd
dependencies: [1]
---

# Phase 3: Real Data Hooks + RevenueChart

## Overview

Create TanStack Query hooks for all report endpoints. Wire RevenueChart to fetch real data instead of mock.

## New File: `src/hooks/use-reports.ts`

```typescript
export function useDailyReport(from: string, to: string) {
  return useQuery({
    queryKey: ['reports', 'daily', from, to],
    queryFn: () => apiFetch<ReportResponse>(`/api/reports/daily?from=${from}&to=${to}`),
  });
}

export function useTopProducts(from: string, to: string, limit = 10) {
  return useQuery({
    queryKey: ['reports', 'top-products', from, to, limit],
    queryFn: () => apiFetch(`/api/reports/top-products?from=${from}&to=${to}&limit=${limit}`),
  });
}

export function usePeakHours(from: string, to: string) {
  return useQuery({
    queryKey: ['reports', 'peak-hours', from, to],
    queryFn: () => apiFetch(`/api/reports/peak-hours?from=${from}&to=${to}`),
  });
}

export function useCustomerMetrics() {
  return useQuery({
    queryKey: ['reports', 'customers'],
    queryFn: () => apiFetch(`/api/reports/customers`),
  });
}

export function useExportUrl(type: string, from: string, to: string): string {
  const API_BASE = import.meta.env.VITE_API_BASE || '...';
  return `${API_BASE}/api/reports/export?from=${from}&to=${to}&type=${type}`;
}
```

## Modify: `src/components/admin/RevenueChart.tsx`

- Accept `data` prop (already does — currently gets mock data from parent)
- Add loading state: skeleton bars
- Add error state: retry button
- Empty state: "Chưa có dữ liệu doanh thu" (already exists)
- Period toggle (7d / 30d / 90d) changes the API `from` param

## Related Code Files

- Create: `src/hooks/use-reports.ts`
- Modify: `src/components/admin/RevenueChart.tsx`
- Modify: `src/pages/admin/Dashboard.tsx` (partially — pass real data)

## Success Criteria

- [ ] RevenueChart displays real data from D1
- [ ] Period toggle (7d/30d/90d) re-fetches with correct range
- [ ] Loading skeleton shown while fetching
- [ ] Error state with retry button
- [ ] Empty state shown when no data
- [ ] No breaking changes to component interface
