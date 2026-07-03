---
phase: 3
title: "A3: Frontend Analytics Charts + Dashboard Integration"
status: pending
priority: P1
effort: 2h
mode: default
stream: A
---

# Phase A3: Frontend Analytics Charts + Dashboard Integration

## Overview

Wire admin dashboard to new analytics endpoints. Replace mock data with real D1 queries.

## Requirements

- `useAnalytics()` TanStack Query hook for all 4 endpoints
- RevenueChart — SVG/CSS line chart for daily revenue
- TopProductsChart — horizontal bar chart
- PeakHoursChart — 24h bar chart
- CustomerMetrics — 4 stat cards
- CSV export button → triggers download
- Loading skeleton + error state + empty state for all widgets
- Dark navy + chrome + glassmorphism styling

## Related Code Files

- Create: `src/hooks/use-analytics.ts`
- Create: `src/components/admin/RevenueChart.tsx`
- Create: `src/components/admin/TopProductsChart.tsx`
- Create: `src/components/admin/PeakHoursChart.tsx`
- Create: `src/components/admin/CustomerMetrics.tsx`
- Modify: `src/pages/admin/Dashboard.tsx`

## Implementation Steps

1. Create `use-analytics.ts` — React Query hooks + CSV download
2. Create RevenueChart (SVG/CSS line chart)
3. Create TopProductsChart (horizontal bars)
4. Create PeakHoursChart (24 bars)
5. Create CustomerMetrics (4 stat cards)
6. Integrate all into Dashboard.tsx
7. Add loading/error/empty states
8. `npm test` + `npm run build`

## Success Criteria

- [ ] All 4 widgets render real D1 data
- [ ] Loading skeleton shown during fetch
- [ ] Error state on API failure
- [ ] Empty state when no data
- [ ] CSV export triggers browser download
- [ ] Dark theme applied consistently
- [ ] All existing tests pass
- [ ] `npm run build` — 0 errors
