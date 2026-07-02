---
phase: 5
title: "Frontend: CustomerMetrics + Export + Dashboard Integration"
status: pending
priority: P1
effort: 0.5h
dependencies: [2, 3, 4]
---

# Phase 5: Customer Metrics + Export + Dashboard Integration

## Overview

Create CustomerMetrics widget, add export button, wire everything into the dashboard. Remove mock data.

## New: `src/components/admin/CustomerMetrics.tsx`

Four stat cards in a row:

```tsx
interface CustomerMetricsData {
  total_customers: number;
  new_customers_30d: number;
  repeat_rate: number;
  avg_spend_per_customer: number;
}

interface CustomerMetricsProps {
  data: CustomerMetricsData | null;
  loading?: boolean;
  error?: string | null;
}
```

| Card | Icon | Value |
|------|------|-------|
| Tổng khách | 👥 | total_customers |
| Khách mới (30d) | 🆕 | new_customers_30d |
| Tỷ lệ quay lại | 🔄 | repeat_rate % |
| Chi tiêu TB | 💰 | avg_spend_per_customer |

## Modify: `src/pages/admin/Dashboard.tsx`

Major modifications:
1. Import all new hooks and widgets
2. Replace `generateMockChartData()` with real data fetching
3. Add state for selected period (7d/30d/90d)
4. Add all widgets in logical layout:
   - Row 1: Stats cards (existing — stays)
   - Row 2: RevenueChart (real data now)
   - Row 3: TopProductsChart + PeakHoursChart (side by side on desktop)
   - Row 4: CustomerMetrics
5. Add Export button in header: dropdown with Orders / Revenue / Customers
6. Loading states for each section independently
7. Remove `generateMockChartData()` function

## Add Export Button

```tsx
const [showExport, setShowExport] = useState(false);

<Button onClick={() => setShowExport(!showExport)}>
  📥 Tải báo cáo
</Button>
{showExport && (
  <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border p-2 z-10">
    <a href={exportUrl('orders')} download className="block px-4 py-2 text-sm hover:bg-gray-50">Đơn hàng (CSV)</a>
    <a href={exportUrl('revenue')} download className="block px-4 py-2 text-sm hover:bg-gray-50">Doanh thu (CSV)</a>
    <a href={exportUrl('customers')} download className="block px-4 py-2 text-sm hover:bg-gray-50">Khách hàng (CSV)</a>
  </div>
)}
```

## Related Code Files

- Create: `src/components/admin/CustomerMetrics.tsx`
- Modify: `src/pages/admin/Dashboard.tsx`
- Modify: `src/components/admin/RevenueChart.tsx` (config period from parent)

## Success Criteria

- [ ] CustomerMetrics shows 4 stat cards with real data
- [ ] Export dropdown shows 3 options
- [ ] CSV download triggers on click
- [ ] All loading states shown independently per widget
- [ ] One widget error doesn't break others
- [ ] `generateMockChartData()` removed completely
- [ ] Build passes with 0 errors
- [ ] All 1,033 tests still pass
