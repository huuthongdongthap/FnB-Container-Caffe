# B2: Advanced Sales Reporting

**Date:** 2026-07-03
**Status:** Planned
**Priority:** P1 High
**Source:** docs/05_TASKS/admin.md Story 4 (partial), docs/05_TASKS/payments.md Story 3 (basic)
**Effort:** 6-8 hours
**Dependencies:** None (enhances existing analytics infrastructure)

---

## 1. Technical Design

### Problem Statement

The admin dashboard currently shows daily revenue, top products, order volume, and basic CSV export (completed in Stream A). Missing features: period comparison (this week vs last week), advanced grouping (by hour, day, product, category, payment method), and date range filtering with custom presets. The cafe owner needs to answer "how did we do vs last week?" and "what's selling best during lunch?"

### Architecture

Extend the existing `GET /api/admin/metrics` endpoint with query parameters for period comparison and grouping. Add a new React page at `/admin/sales-reports` with period selector, chart widgets, and CSV export.

```
Worker Layer:
  GET /api/admin/metrics?range=7d&compare=true
    └── Query D1 orders + payments tables
    └── Return current + previous period aggregates

Frontend Layer:
  SalesReports.tsx
    ├── PeriodSelector (7d / 30d / custom date range)
    ├── RevenueComparisonChart (current vs previous period overlay)
    ├── GroupedSalesChart (by hour / day / category / payment)
    └── CSVExportButton
```

### Key Design Decisions

1. **No new tables** — All data queries from existing `orders`, `order_items`, `payments` tables. D1 SQL aggregations are sufficient.

2. **KV cache** — Cache period comparison results for 30s to avoid repeated aggregations. Invalidate on new order completion.

3. **Reuse analytics stores** — Extend existing `use-analytics-store.ts` Zustand store with period comparison fields rather than creating a new store.

4. **Bilingual labels** — All chart labels, axis titles, and CSV column headers in VN+EN.

---

## 2. File List

### Files to Create

| File | Purpose |
|------|---------|
| `src/pages/admin/SalesReports.tsx` | Period comparison page with chart widgets |
| `src/components/admin/PeriodComparisonChart.tsx` | Revenue comparison chart (current vs previous) |
| `src/components/admin/GroupedSalesChart.tsx` | Grouped sales by hour/day/category/payment |

### Files to Modify

| File | Change |
|------|--------|
| `worker/src/routes/analytics-hono.ts` | Add `compare=true` query param support, add grouping dimensions |
| `src/tree/analytics/use-analytics-store.ts` | Add comparison data fields, period selector state |
| `src/pages/admin/Dashboard.tsx` | Add link to `/admin/sales-reports` |

---

## 3. Database Changes

None. All queries against existing `orders`, `order_items`, `payments` tables.

Example query for period comparison:
```sql
SELECT
  DATE(created_at) as day,
  SUM(total) as revenue,
  COUNT(*) as order_count
FROM orders
WHERE DATE(created_at) BETWEEN DATE('now', '-6 days') AND DATE('now')
  AND status IN ('paid', 'served', 'completed')
GROUP BY DATE(created_at)
ORDER BY day;
```

---

## 4. API Endpoints

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/api/admin/metrics?range=7d&compare=true` | Current + previous period comparison | Staff |
| GET | `/api/admin/metrics?range=7d&group=hour` | Grouped data by dimension | Staff |
| GET | `/api/admin/sales/csv?range=7d` | CSV export with full data | Staff |

Query parameters:

| Param | Values | Default | Description |
|-------|--------|---------|-------------|
| `range` | `24h`, `7d`, `30d`, `custom` | `7d` | Time range |
| `start` / `end` | ISO date | — | Custom range (when range=custom) |
| `compare` | `true`, `false` | `false` | Include previous period for comparison |
| `group` | `hour`, `day`, `category`, `payment` | — | Grouping dimension for chart data |

---

## 5. Frontend Components

| Component | File | Description |
|-----------|------|-------------|
| SalesReports | `src/pages/admin/SalesReports.tsx` | Main page: period selector, comparison chart, grouped chart, CSV export |
| PeriodComparisonChart | `src/components/admin/PeriodComparisonChart.tsx` | Bar/line chart with current vs previous overlay. Recharts if already installed; otherwise pure CSS bar chart (YAGNI). |
| GroupedSalesChart | `src/components/admin/GroupedSalesChart.tsx` | Bar chart grouped by selected dimension. Toggle: Hour | Day | Category | Payment Method |

Zustand store additions to `use-analytics-store.ts`:
```
State: period, startDate, endDate, compareEnabled, groupBy, comparisonData, loading
Actions: setPeriod, setGroupBy, fetchComparison, fetchGroupedData
```

---

## 6. Tests

| Test | File | What to verify |
|------|------|----------------|
| Analytics API comparison | `worker/src/__tests__/routes/analytics-hono.test.ts` | `compare=true` returns both periods, correct delta calculation |
| Analytics API grouping | `worker/src/__tests__/routes/analytics-hono.test.ts` | Grouped by hour/day/category returns correct shape |
| CSV export | `worker/src/__tests__/routes/analytics-hono.test.ts` | CSV headers correct, data rows match query |
| Frontend period selector | `src/pages/admin/__tests__/SalesReports.test.tsx` | Period change triggers correct API call, comparison data renders |

---

## 7. Acceptance Criteria

- [ ] Period comparison: "This week vs last week" overlay on revenue chart
- [ ] Grouped sales: switch between hourly, daily, category, payment method views
- [ ] Custom date range: start/end date picker with validation (end >= start)
- [ ] CSV export: downloads with bilingual headers, date range in filename
- [ ] KV cache: 30s TTL, invalidated on new order
- [ ] Zero regression: existing dashboard and analytics untouched
- [ ] Loading states: skeleton while fetching
- [ ] Error states: retry button on fetch failure
- [ ] Empty state: "No sales data for this period" message

---

## 8. Rollback Plan

```bash
git checkout HEAD -- src/pages/admin/SalesReports.tsx src/components/admin/
git checkout HEAD -- worker/src/routes/analytics-hono.ts src/tree/analytics/
```

---

## 9. Estimated Effort

| Task | Time |
|------|------|
| Extend analytics-hono.ts with compare+group params | 1.5h |
| Write API tests | 30 min |
| Extend use-analytics-store.ts with comparison fields | 20 min |
| Build PeriodComparisonChart component | 1h |
| Build GroupedSalesChart component | 45 min |
| Build SalesReports page | 1h |
| Build CSV export endpoint | 30 min |
| Build + test verification | 20 min |
| **Total** | **~6h** |
