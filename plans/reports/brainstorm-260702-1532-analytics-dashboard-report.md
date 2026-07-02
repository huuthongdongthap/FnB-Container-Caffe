---
title: "Real Analytics Dashboard — Design Report"
date: 2026-07-02
status: approved
mode: text
---

# Real Analytics Dashboard — Design Report

**Problem:** Admin dashboard uses mock data (`generateMockChartData()`). Owner can't see actual revenue trends, popular items, or customer behavior.

**Solution:** Wire dashboard to real D1 data. Add 4 data widgets. Keep existing layout.

## Existing Infrastructure

| API | What | Status |
|-----|------|--------|
| `GET /api/reports/daily?from=&to=` | Daily revenue, orders, signups, cashback | ✅ Exists |
| `GET /api/reports/summary` | Total KPIs (revenue, orders, customers, churn) | ✅ Exists |
| `GET /api/reports/orders?from=&to=` | Order metrics by status | ✅ Exists |
| `GET /api/admin/metrics?range=24h` | System observability | ✅ Exists |

## New Backend Endpoints

### `GET /api/reports/top-products?from=&to=&limit=10`
Parse `items` JSON column in orders, aggregate by product name:
```sql
-- Parse items JSON array, extract product names + quantities
-- This requires unnesting the JSON items column
```

### `GET /api/reports/peak-hours?from=&to=`
Count orders grouped by hour of day:
```sql
SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, COUNT(*) as count
FROM orders WHERE DATE(created_at) BETWEEN ? AND ?
GROUP BY hour ORDER BY hour
```

### `GET /api/reports/customers`
Customer loyalty metrics:
- Total customers, new customers (30d)
- Repeat rate (% of customers with >1 order)
- Avg spend per customer
- Avg orders per customer

### `GET /api/reports/export?from=&to=&type=orders|revenue|customers`
CSV export endpoint — returns `text/csv` Content-Type with relevant columns.

## Frontend Widgets

### 1. RevenueChart (MODIFY)
**File:** `src/components/admin/RevenueChart.tsx`
- Fetch from `GET /api/reports/daily?from=30days&to=today`
- Period toggle (7d / 30d / 90d) changes `from` param
- Empty state when no data ("Chưa có dữ liệu")
- Loading skeleton
- Error state

### 2. TopProductsChart (NEW)
**File:** `src/components/admin/TopProductsChart.tsx`
- Horizontal bar chart (pure CSS/SVG — no chart library)
- Top 10 products by quantity sold
- Shows: product name, qty sold, revenue
- Responsive

### 3. PeakHoursChart (NEW)
**File:** `src/components/admin/PeakHoursChart.tsx`
- Bar chart: 24 bars (0-23h)
- Shows order count per hour
- Color gradient: higher = brighter
- Responsive

### 4. CustomerMetrics (NEW)
**File:** `src/components/admin/CustomerMetrics.tsx`
- 4 stat cards in a row:
  - 👥 Total customers
  - 🆕 New (30d)
  - 🔄 Repeat rate %
  - 💰 Avg spend/customer

### 5. Export Button
- In dashboard header
- Dropdown: Export Orders / Export Revenue / Export Customers
- Opens CSV download

### 6. Dashboard Layout (MODIFY)
**File:** `src/pages/admin/Dashboard.tsx`
- Remove `generateMockChartData()`
- Add TopProductsChart + PeakHoursChart below RevenueChart
- Add CustomerMetrics row
- Add Export button in header
- Fetch real data via `use-reports.ts` hooks

## Data Flow

```
Dashboard mount
  → fetchReportsSummary() → GET /api/reports/summary
  → fetchDailyReport(range) → GET /api/reports/daily?from=...&to=...
  → fetchTopProducts(range) → GET /api/reports/top-products?from=...&to=...
  → fetchPeakHours(range) → GET /api/reports/peak-hours?from=...&to=...
  → fetchCustomerMetrics() → GET /api/reports/customers
  → Render all widgets
  → Period toggle re-fetches with new range
```

## Scope Boundary

**In scope:** 4 backend endpoints, 4 frontend widgets, 1 export, wired into existing Dashboard.
**Out of scope:** Date range picker (for now — uses preset periods), standalone reports page, email reports, scheduled reports, PDF export.

## Touchpoints

| File | Action |
|------|--------|
| `worker/src/routes/reports.ts` | ADD: top-products, peak-hours, customers, export |
| `worker/src/index.ts` | MODIFY: register new routes |
| `src/hooks/use-reports.ts` | NEW: TanStack Query hooks |
| `src/components/admin/RevenueChart.tsx` | MODIFY: fetch real data |
| `src/components/admin/TopProductsChart.tsx` | NEW: bar chart |
| `src/components/admin/PeakHoursChart.tsx` | NEW: hour chart |
| `src/components/admin/CustomerMetrics.tsx` | NEW: stat cards |
| `src/pages/admin/Dashboard.tsx` | MODIFY: integrate all widgets |
| `src/hooks/stores/admin/use-admin-dashboard-store.ts` | MODIFY or bypass (switch to hooks) |

## Risk

- Parsing `items` JSON column in SQL: some orders may have malformed JSON → handle with try/catch in JS, not SQL
- Large datasets: add LIMIT and date bounds to all queries
- Export for large date ranges: keep under Worker CPU timeout (30s on free plan)
