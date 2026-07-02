---
phase: 4
title: "Frontend: Top Products + Peak Hours Widgets"
status: pending
priority: P1
effort: 0.5h
dependencies: [1, 3]
---

# Phase 4: Top Products + Peak Hours Widgets

## Overview

Create two visualization widgets for the dashboard.

## New: `src/components/admin/TopProductsChart.tsx`

Horizontal bar chart (pure CSS — no chart library):

- Top 10 products by quantity sold
- Each row: product name (left) + bar (visual qty) + qty count + revenue (right)
- Colors: chrome/navy gradient matching existing dark theme
- States: loading (skeleton), empty, error

```tsx
interface TopProduct {
  name: string;
  qty: number;
  revenue: number;
}

interface TopProductsChartProps {
  data: TopProduct[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}
```

## New: `src/components/admin/PeakHoursChart.tsx`

Bar chart showing order count by hour (0-23):

- 24 vertical bars in a row
- Bar height proportional to order count
- Color: warmer gradient for higher values
- X-axis labels: 0, 6, 12, 18, 24
- States: loading (skeleton), empty, error

```tsx
interface PeakHour {
  hour: number;
  order_count: number;
  revenue: number;
}

interface PeakHoursChartProps {
  data: PeakHour[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}
```

## Related Code Files

- Create: `src/components/admin/TopProductsChart.tsx`
- Create: `src/components/admin/PeakHoursChart.tsx`

## Success Criteria

- [ ] TopProductsChart renders horizontal bars sorted by qty
- [ ] PeakHoursChart renders 24 bars with hour labels
- [ ] Loading skeletons shown while fetching
- [ ] Empty state when no data
- [ ] Zero TypeScript errors
