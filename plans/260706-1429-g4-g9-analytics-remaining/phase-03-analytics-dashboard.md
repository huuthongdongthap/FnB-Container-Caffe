---
title: "Analytics Dashboard — Phase 3 Execution"
description: "Wire weekly/monthly revenue data, staff performance metrics, chart tests, and navigation integration"
status: pending
date: 2026-07-06
priority: P2
effort: 3.5h
tags: [analytics, dashboard, charts, tests, navigation]
source: plans/260702-1532-analytics-dashboard/plan.md
---

# Analytics Dashboard — Phase 3 Detailed Execution

## Context Summary

**Source plan:** `plans/260702-1532-analytics-dashboard/plan.md` (5-phase, TDD per phase).

**Current codebase state (verified 2026-07-06):**

| Layer | Status | Location |
|-------|--------|----------|
| Backend routes | DONE | `worker/src/routes/analytics-hono.ts` — 5 endpoints at `/api/analytics/` |
| Backend tree layer | DONE | `worker/src/tree/analytics/{summary,top-products,peak-hours,customer-metrics,csv-export}.ts` |
| Backend tests | DONE | `worker/src/__tests__/routes/analytics.test.ts` (972 lines) |
| Frontend hooks | DONE | `src/hooks/use-analytics-data.ts` — 4 hooks |
| Frontend components | DONE | `src/components/admin/{RevenueChart,TopProductsChart,PeakHoursChart,CustomerMetrics}.tsx` |
| Dashboard page | DONE | `src/pages/admin/Dashboard.tsx` — wires all 4 charts + CSV export |
| SalesReports page | DONE | `src/pages/admin/SalesReports.tsx` — advanced reports with compare/group |
| Metrics page | DONE | `src/pages/admin/Metrics.tsx` — system observability (separate) |

**What this phase actually needs to complete the plan:**

| # | Task | Effort | Why needed |
|---|------|--------|------------|
| 1 | Backend: add `period` param to `/api/analytics/` (daily/weekly/monthly aggregation) | 0.5h | RevenueChart UI buttons exist but fetch always returns 30-day daily data |
| 2 | Backend: add `staff-performance` endpoint | 0.5h | Listed in plan metrics but never built; `staff_shifts` table exists but not linked to orders |
| 3 | Frontend: wire RevenueChart period toggle to actual API calls | 0.25h | Period buttons render but all 3 modes hit same endpoint |
| 4 | Frontend: create StaffPerformance widget | 0.5h | Top staff by orders/revenue per shift |
| 5 | Tests: component-level tests for all 4 chart widgets | 0.75h | Zero component tests exist; plan TDD discipline requires coverage |
| 6 | Tests: hook-level tests for `use-analytics-data.ts` | 0.5h | No hook tests exist |
| 7 | Navigation: add dedicated Analytics page | 0.25h | Analytics currently buried in Dashboard; sidebar has no Analytics entry |

**Out of scope (already done or not in plan):** GroupedSalesChart, PeriodComparisonChart, SalesReports page period selector.

---

## Phase 3: Frontend Real Data Hooks + Chart Wiring + Staff Metrics + Tests

**Effort:** 3.5h total
**Parallelism:** Backend (steps 1-2) can run in parallel with frontend test stubs (step 5-6)

### Step 1: Backend — Add `period` parameter to summary endpoint (0.5h)

**File:** `worker/src/routes/analytics-hono.ts:43-47` (modify)
**File:** `worker/src/tree/analytics/summary.ts` (add date-bucketing helper)

**Change:** Extend the root `/api/analytics/` endpoint to accept a `period` query param that controls the date bucket size for the aggregate query.

Current schema at `analytics-hono.ts:43-47`:
```ts
const summarySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  compare: z.coerce.boolean().optional(),
  group: z.enum(['hour', 'day', 'category', 'payment']).optional(),
});
```

New schema adds `period`:
```ts
const summarySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  period: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  compare: z.coerce.boolean().optional(),
  group: z.enum(['hour', 'day', 'category', 'payment']).optional(),
});
```

**Backend tree change** (`summary.ts`): Add `getPeriodRevenue(db, period, days)` that returns bucketed data:
- `daily`: existing behavior — one row per day for last N days
- `weekly`: group by ISO week (`strftime('%Y-W%W', created_at)`), last N weeks
- `monthly`: group by year-month (`strftime('%Y-%m', created_at)`), last N months

**Data contract:**
```ts
// New response shape for period queries
interface PeriodRevenueRow {
  label: string;    // "2026-07-05" daily | "W27" weekly | "2026-07" monthly
  revenue: number;
  orders: number;
}
```

**Implementation:**
1. Add `getPeriodRevenue()` to `summary.ts` — 3 SQL queries based on period enum
2. Update `analytics-hono.ts` root route: when `period` is `weekly` or `monthly`, call `getPeriodRevenue()` instead of `getSummary()`
3. KV cache key includes period: `analytics:period:${period}:${days}`

**Validation:**
- Unit test 3 SQL variants in `summary.ts` (existing test file)
- Integration test: `GET /api/analytics/?period=weekly&days=30` returns `PeriodRevenueRow[]`
- No KV cache collision with existing daily summary

**Files touched:**
- `worker/src/tree/analytics/summary.ts` — add function
- `worker/src/routes/analytics-hono.ts` — extend schema + route logic
- `worker/src/__tests__/routes/analytics.test.ts` — add period test cases

### Step 2: Backend — Add staff performance endpoint (0.5h)

**Files:**
- CREATE: `worker/src/tree/analytics/staff-performance.ts`
- MODIFY: `worker/src/routes/analytics-hono.ts` — add `GET /staff-performance` route
- MODIFY: `worker/src/__tests__/routes/analytics.test.ts` — add test coverage

**Background:** `staff_shifts` table exists (`worker/schema.sql:454-461`) but is only used for shift logging. The analytics router has NO staff performance endpoint.

**New endpoint:** `GET /api/analytics/staff-performance?days=30`

**Query logic** (`staff-performance.ts`):
```sql
-- Staff performance by shift for last N days
SELECT
  s.staff_name,
  s.role,
  COUNT(o.id) AS total_orders,
  COALESCE(SUM(o.total), 0) AS total_revenue,
  COALESCE(AVG(o.total), 0) AS avg_order_value,
  COUNT(DISTINCT date(s.created_at)) AS shifts_worked
FROM staff_shifts s
LEFT JOIN orders o ON o.created_at >= s.created_at
  AND o.status != 'cancelled'
  AND date(o.created_at) = date(s.created_at)
WHERE s.created_at >= datetime('now', '-' || ? || ' days')
GROUP BY s.staff_name, s.role
ORDER BY total_revenue DESC
```

**Alternative approach** (if no staff→order link exists): Use `customer_phone` or `notes` field in staff_shifts as a proxy. The fallback query uses only shift data:
```sql
SELECT staff_name, role,
  COUNT(*) as shifts_logged,
  COUNT(DISTINCT date(created_at)) as active_days
FROM staff_shifts
WHERE created_at >= datetime('now', '-' || ? || ' days')
GROUP BY staff_name, role
ORDER BY active_days DESC
```

**Response schema:**
```ts
interface StaffPerformanceRow {
  staff_name: string;
  role: string;
  total_orders: number;
  total_revenue: number;
  avg_order_value: number;
  shifts_worked: number;
}
```

**Frontend type** (added to `src/hooks/use-analytics-data.ts`):
```ts
export interface StaffPerformanceData extends StaffPerformanceRow {}
```

**Frontend hook:**
```ts
export function useStaffPerformance(days = 30) {
  return useQuery<StaffPerformanceRow[]>({
    queryKey: ['analytics', 'staff-performance', days],
    queryFn: async () => {
      const res = await apiFetch<ApiSuccess<StaffPerformanceRow[]>>(
        `/api/analytics/staff-performance?days=${days}`
      );
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
```

**Validation:**
- Unit test: mock D1 returns staff rows, verify API response shape
- Integration: hit endpoint with test DB, verify ordering + aggregation

### Step 3: Frontend — Wire RevenueChart period toggle to API (0.25h)

**File:** `src/hooks/use-analytics-data.ts` (modify)
**File:** `src/pages/admin/Dashboard.tsx` (modify)

**Current state:** `Dashboard.tsx:34` has `const [period, setPeriod]` but `useDailyRevenue` (line 64-68) ignores it — always fetches 30-day daily data.

**Change:**
1. Add `usePeriodRevenue(period, days)` hook in `use-analytics-data.ts`:
```ts
export function usePeriodRevenue(period: 'daily' | 'weekly' | 'monthly', days = 30) {
  return useQuery<PeriodRevenueRow[]>({
    queryKey: ['analytics', 'period-revenue', period, days],
    queryFn: async () => {
      const res = await apiFetch<ApiSuccess<PeriodRevenueRow[]>>(
        `/api/analytics/?period=${period}&days=${days}`
      );
      return res.data;
    },
    staleTime: 5 * 60_000,
  });
}
```

2. In `Dashboard.tsx:64-68`, replace `useDailyRevenue` with `usePeriodRevenue(period)`:
```ts
const { data: periodRevenue, ... } = usePeriodRevenue(period);
const chartData = (periodRevenue || []).map((d) => ({ label: d.label, value: d.revenue }));
const chartTotal = (periodRevenue || []).reduce((s, d) => s + d.revenue, 0);
```

**Data contract mapping:**
- Backend returns `{ label, revenue, orders }`
- `RevenueChart` expects `{ label: string; value: number }[]`
- Mapping: `d.label` → `label`, `d.revenue` → `value`

**Period→days mapping** (Dashboard only shows 30-day window regardless of granularity):
- `daily`: 30 days → 30 rows
- `weekly`: 30 days → ~4-5 rows
- `monthly`: 30 days → 1 row (insufficient). Use `days=365` for monthly view.

**Handle:** Dashboard derives days from period:
```ts
const periodDays = period === 'monthly' ? 365 : 30;
```

### Step 4: Frontend — Create StaffPerformance widget (0.5h)

**File:** CREATE `src/components/admin/StaffPerformance.tsx`
**File:** MODIFY `src/pages/admin/Dashboard.tsx` — add import + widget section

**Component contract:**
```ts
interface StaffPerformanceProps {
  data: StaffPerformanceRow[] | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}
```

**UI structure:** (matches existing dashboard card pattern)
```
┌─────────────────────────────┐
│ NHAN VIEN XUAT SAC / Staff Performance
├─────────────────────────────┤
│ Rank │ Name    │ Role │ Orders │ Revenue │ Avg │
│  1   │ An      │Cashier│  145  │ 4.2M₫  │... │
│  2   │ Binh    │Barista│  98   │ 2.1M₫  │... │
│  ... │ ...     │ ...  │  ...  │  ...   │... │
├─────────────────────────────┤
│ Shifts summary: X staff, Y shifts total
└─────────────────────────────┘
```

**Styles:** Same glass-morphism pattern as TopProductsChart:
- `rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)]`
- `backdrop-blur-[var(--glass-blur)]`
- Revenue formatted via `formatVnd()`
- Loading: shimmer skeleton (4 rows)
- Error: error state with retry button (same SVG pattern as TopProductsChart)
- Empty: "Chua co du lieu" message

**Placement in Dashboard:** Insert after CustomerMetrics (Dashboard.tsx:200), before RevenueChart (line 202):
```tsx
{/* Staff Performance */}
<div className="mb-6">
  <StaffPerformance
    data={staffPerformance ?? null}
    loading={staffLoading}
    error={staffErrorMsg}
    onRetry={() => refetchStaff()}
  />
</div>
```

**i18n keys needed:**
- `staffPerformance.title` → "NHAN VIEN XUAT SAC / Staff Performance"
- `staffPerformance.rank` → "#"
- `staffPerformance.name` → "Ten"
- `staffPerformance.role` → "Vai tro"
- `staffPerformance.orders` → "Don hang"
- `staffPerformance.revenue` → "Doanh thu"
- `staffPerformance.avgOrder` → "TB/Don"
- `staffPerformance.shifts` → "Ca lam"
- `staffPerformance.empty` → "Chua co du lieu nhan vien"
- `staffPerformance.error` → "Khong tai duoc du lieu nhan vien"

### Step 5: Tests — Component-level chart tests (0.75h)

**Files:**
- CREATE: `src/components/admin/__tests__/revenue-chart.test.tsx`
- CREATE: `src/components/admin/__tests__/top-products-chart.test.tsx`
- CREATE: `src/components/admin/__tests__/peak-hours-chart.test.tsx`
- CREATE: `src/components/admin/__tests__/customer-metrics.test.tsx`
- CREATE: `src/components/admin/__tests__/staff-performance.test.tsx`

**Test framework:** Vitest (matches existing `npm test` runner). Use `@testing-library/react`.

**Test matrix per component:**

| Component | Rendered with data | Loading state | Error state | Empty state | Snapshot |
|-----------|-------------------|---------------|-------------|-------------|----------|
| RevenueChart | 5 data points with total | shimmer bars | error + retry btn | "Chua co du lieu" | optional |
| TopProductsChart | 3 products with qty+revenue | shimmer rows | error + retry btn | "noProductData" | optional |
| PeakHoursChart | 24h data with peak+zero | shimmer block | error + retry btn | "Chua co du lieu gio cao diem" | optional |
| CustomerMetrics | 4 cards with data | 4 shimmer cards | error + retry btn | null (hidden) | optional |
| StaffPerformance | 3 staff rows with all fields | 4 shimmer rows | error + retry btn | "Chua co du lieu nhan vien" | optional |

**Specific assertions per component:**

**RevenueChart.test.tsx:**
- Renders SVG with `<polyline>` when data present
- Renders 5 `<circle>` dots for 5 data points
- Renders 3 period buttons (Ngay/Tuan/Thang) when `onPeriodChange` provided
- Calls `onPeriodChange('weekly')` when weekly button clicked
- Renders shimmer when `loading=true` and `data.length===0`
- Renders error state + retry button when `error` set
- Renders empty state when `data.length===0`

**TopProductsChart.test.tsx:**
- Renders N product rows equal to `data.length`
- Each row contains product_name, qty ("X cai"), formatted revenue
- Rank numbers start at 1
- Bar width proportional to max qty (longest bar = 100%)
- Skeleton: 5 shimmer rows
- Sorts data internally (test with unsorted input → verify sorted output)

**PeakHoursChart.test.tsx:**
- Renders 24 bars (zero-filled test passes `PeakHour[]` of length 24)
- Evaluates height formula: `(count/maxCount)*100` with CSS `min-h-[2px]`
- Shows hour labels every 3 hours (0, 3, 6, 9, 12, 15, 18, 21)
- Skeleton: one shimmer block

**CustomerMetrics.test.tsx:**
- Renders 4 StatCards: Tong khach, Khach moi (30d), Ty le quay lai, Gia tri TB don
- `repeat_rate` formatted as "X.X%" (e.g., 0.35 → "35.0%")
- `new_30d` prefixed with `+` (e.g., 12 → "+12")
- Values formatted with `.toLocaleString('vi-VN')`

**StaffPerformance.test.tsx:**
- Renders table with columns: rank, name, role, orders, revenue, avg, shifts
- `formatVnd()` applied to revenue and avg values
- Sorted by total_revenue descending (test with reversed input)
- Footer shows staff count + total shift count

### Step 6: Tests — Hook-level tests for use-analytics-data.ts (0.5h)

**File:** CREATE `src/hooks/__tests__/use-analytics-data.test.ts`

**Framework:** Vitest + `msw` (Mock Service Worker) for fetch mocking, or manual `vi.spyOn(global, 'fetch')`. Check what existing tests use.

**Test cases:**

| Hook | Test | Assertion |
|------|------|-----------|
| `useTopProducts(5)` | calls correct URL | fetch called with `/api/analytics/top-products?limit=5` |
| `useTopProducts()` | default limit | fetch called with `?limit=10` |
| `useTopProducts()` | returns data | query returns parsed `data` array |
| `useTopProducts()` | staleTime | query has `staleTime: 300000` |
| `usePeakHours(14)` | calls correct URL | fetch called with `/api/analytics/peak-hours?days=14` |
| `usePeakHours()` | default days | fetch called with `?days=30` |
| `useCustomerMetrics()` | calls correct URL | fetch called with `/api/analytics/customer-metrics` |
| `useDailyRevenue('2026-07-01','2026-07-31')` | uses query params | fetch called with date range |
| `useDailyRevenue()` | default date range | uses last 30 days |
| `downloadAnalyticsCsv` | triggers download | creates `<a>` with `download` attr + blob URL |
| `downloadAnalyticsCsv` | includes auth header | fetch called with `Authorization: Bearer ...` |
| `usePeriodRevenue('weekly',30)` | (NEW) | fetch called with `/api/analytics/?period=weekly&days=30` |
| `useStaffPerformance(14)` | (NEW) | fetch called with `/api/analytics/staff-performance?days=14` |

### Step 7: Navigation — Add Analytics sidebar entry (0.25h)

**File:** MODIFY `src/pages/admin/AdminSidebar.tsx:60-66`

**Current state:** Sidebar has "Phân tích / Analytics" section with 2 items:
- `Phân tích` → `/admin/metrics` (system observability, NOT business analytics)
- `Báo cáo` → `/admin/sales-reports`

**Change:** Add a `Dashboard Analytics` entry pointing to `/admin` (which already has all charts wired):

```ts
{
  title: 'Phân tích / Analytics',
  items: [
    { label: 'Dashboard', labelEn: 'Dashboard', to: '/admin', icon: LayoutDashboard },
    { label: 'Phân tích', labelEn: 'Metrics', to: '/admin/metrics', icon: BarChart3 },
    { label: 'Báo cáo', labelEn: 'Sales Reports', to: '/admin/sales-reports', icon: FileBarChart },
  ],
},
```

**Alternative** (if a dedicated `/admin/analytics` page is desired):
- CREATE: dedicated analytics page or just link to existing `/admin`
- Route already exists: `/admin` → AdminDashboardPage

**No route changes needed** — `/admin` is already defined in `App.tsx:111`.

**i18n:** Add `dashboard` key to admin namespace if not present. Verify `t('dashboard')` already works (Dashboard.tsx:130 uses `t('dashboard')` — likely already exists).

---

## Data Flow Diagrams

### RevenueChart period toggle flow

```
User clicks "Tuan" button
  → Dashboard.setState('weekly')
    → usePeriodRevenue('weekly', 365) re-fetches
      → GET /api/analytics/?period=weekly&days=365
        → summary.ts: getPeriodRevenue(db, 'weekly', 365)
          → SQL: GROUP BY strftime('%Y-W%W', created_at)
        → Returns: [{ label: 'W26', revenue: 450000, orders: 12 }, ...]
      → chartData = rows.map(d => ({label: d.label, value: d.revenue}))
    → RevenueChart re-renders SVG with ~17 data points (30 weeks)
```

### Staff performance flow

```
Dashboard mounts
  → useStaffPerformance(30) fires
    → GET /api/analytics/staff-performance?days=30
      → staff-performance.ts: query staff_shifts + LEFT JOIN orders
        → Returns: [{ staff_name: 'An', role: 'Cashier', total_orders: 145, ... }, ...]
    → StaffPerformance renders table rows ranked by total_revenue
```

### CSV export flow (no change — document for completeness)

```
User clicks "Xuat CSV"
  → Dashboard.handleExport()
    → start = 30 days ago, end = today
    → downloadAnalyticsCsv(start, end)
      → GET /api/analytics/export?start=...&end=...
        → csv-export.ts: getOrdersInRange() + formatCsvRows()
        → Response: text/csv with Content-Disposition header
      → Browser download via <a> click
```

---

## Dependency Graph

```
Step 1 (period param) ─────────┐
                              ├→ Step 3 (wire RevenueChart toggle) → Step 7 (nav)
Step 2 (staff endpoint) ───────┤
                              └→ Step 4 (StaffPerformance widget)
Step 5 (component tests) ← can run parallel with 1-2, 4
Step 6 (hook tests) ← can run parallel with 1-2, 3-4
```

**Blockers:** None. All backend tree modules import only from `@/seed/...` and D1 types. No circular deps.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `staff_shifts` not linked to orders (no shared key) | Medium | Medium | Fallback query shows shift count only, skip revenue if no join possible |
| `period` param breaks existing `/api/analytics/` consumers | Low | High | Default `period=daily` preserves existing behavior; all current callers get same response |
| RevenueChart SVG breaks with >30 weekly data points | Low | Low | SVG uses `viewBox` scaling — handles any count; label filter at 7 max labels |
| Component tests slow CI (Vitest + React Testing Library) | Low | Medium | Keep tests focused — 5-10 assertions each; use `render` not `renderHook` for components |
| `usePeriodRevenue` conflicts with `useDailyRevenue` | Low | Low | New hook, different queryKey — no cache collision |
| Staff name collision (same name, different shifts) | Medium | Low | GROUP BY staff_name + role — two "An" in different roles show separately |
| D1 `strftime('%Y-W%W')` edge cases (week 0/53) | Low | Low | D1 SQLite handles ISO week numbering; test with Dec 31 / Jan 1 boundary |

---

## Backwards Compatibility

1. **API:** `period` param defaults to `daily` — existing `/api/analytics/` callers (SalesReports, Dashboard) get identical responses if they don't pass `period`.
2. **`/api/analytics/staff-performance`:** New endpoint, no existing callers.
3. **`useDailyRevenue`:** NOT removed. New `usePeriodRevenue` hook added. Dashboard.tsx switches to new hook — old hook stays for any other callers.
4. **`use-analytics-data.ts` exports:** All existing exports preserved. New exports (`usePeriodRevenue`, `useStaffPerformance`, `PeriodRevenueRow`, `StaffPerformanceRow`) are additions.
5. **Sidebar nav:** Added new entry, no existing entries removed or reordered.

---

## Acceptance Criteria

### Per-step AC

**Step 1 — Period param:**
- [ ] `GET /api/analytics/?period=daily&days=30` returns `{ success: true, data: { total_orders, total_revenue, avg_order_value, total_customers } }` (unchanged shape)
- [ ] `GET /api/analytics/?period=weekly&days=30` returns `{ success: true, data: [{ label, revenue, orders }, ...] }`
- [ ] `GET /api/analytics/?period=monthly&days=365` returns `{ success: true, data: [{ label, revenue, orders }, ...] }`
- [ ] KV cache key varies by period — weekly cache does not shadow daily cache
- [ ] No Zod validation error on missing `period` (defaults to `daily`)

**Step 2 — Staff performance:**
- [ ] `GET /api/analytics/staff-performance?days=30` returns `{ success: true, data: [{ staff_name, role, total_orders, total_revenue, avg_order_value, shifts_worked }, ...] }`
- [ ] Sorted by `total_revenue DESC`
- [ ] If no `staff_shifts` data, returns empty array (not 500)
- [ ] Staff with same name but different roles appear as separate rows

**Step 3 — Wire RevenueChart:**
- [ ] Clicking "Tuan" fetches weekly data, chart re-renders with ~4-5 data points
- [ ] Clicking "Thang" fetches monthly data, chart re-renders with ~1 point (30d window → 1 month)
- [ ] Label display: weekly shows "W27", monthly shows "2026-07"
- [ ] Default state (page load) fetches daily data with 30-day window

**Step 4 — StaffPerformance widget:**
- [ ] Renders table with columns: Rank, Name, Role, Orders, Revenue, Avg/Order, Shifts
- [ ] Revenue formatted as VND (e.g., "4.200.000₫")
- [ ] Rows sorted by revenue descending
- [ ] Loading shows 4 shimmer rows
- [ ] Error shows retry button
- [ ] Empty shows "Chua co du lieu nhan vien"

**Step 5 — Component tests:**
- [ ] All 5 component test files exist and pass (`npx vitest run src/components/admin/__tests__/`)
- [ ] Total: 40+ test cases across 5 files
- [ ] All existing tests still pass (`npm test` → 844+ passing)

**Step 6 — Hook tests:**
- [ ] `src/hooks/__tests__/use-analytics-data.test.ts` passes
- [ ] Covers all 5 existing hooks + 2 new hooks
- [ ] Tests verify correct URL, queryKey shape, and data mapping

**Step 7 — Navigation:**
- [ ] Sidebar shows "Dashboard" entry under "Phân tích / Analytics" section
- [ ] Clicking navigates to `/admin` (active state highlighted)
- [ ] i18n: label renders in VN, `labelEn` available for EN locale

### Overall AC (gate to mark Phase 3 complete)

- [ ] `npm run build` → 0 TypeScript errors
- [ ] All existing tests pass: `npm test` → 0 failures
- [ ] New component tests pass: `npx vitest run src/components/admin/__tests__/` → 0 failures
- [ ] New hook tests pass: `npx vitest run src/hooks/__tests__/use-analytics-data.test.ts` → 0 failures
- [ ] Backend route tests pass: `npx vitest run worker/src/__tests__/routes/analytics.test.ts` → 0 failures (existing + new cases)
- [ ] Dashboard page renders with all 5 widgets in dev: RevenueChart + TopProductsChart + PeakHoursChart + CustomerMetrics + StaffPerformance
- [ ] RevenueChart period toggle (daily/weekly/monthly) fetches distinct data per mode
- [ ] CSV export still works (no regression)
- [ ] Zero `console.log` / `console.warn` in touched files

---

## File Ownership (no parallel conflicts)

| Step | Files touched | Owner phase |
|------|--------------|-------------|
| 1 | `worker/src/tree/analytics/summary.ts`, `worker/src/routes/analytics-hono.ts`, `worker/src/__tests__/routes/analytics.test.ts` | Backend |
| 2 | CREATE `worker/src/tree/analytics/staff-performance.ts`, modify `analytics-hono.ts`, modify test file | Backend |
| 3 | `src/hooks/use-analytics-data.ts`, `src/pages/admin/Dashboard.tsx` | Frontend |
| 4 | CREATE `src/components/admin/StaffPerformance.tsx`, modify `Dashboard.tsx` | Frontend |
| 5 | CREATE 5 test files under `src/components/admin/__tests__/` | Tests |
| 6 | CREATE `src/hooks/__tests__/use-analytics-data.test.ts` | Tests |
| 7 | `src/pages/admin/AdminSidebar.tsx` | Frontend |

Steps 1-2 run in parallel (no shared file edits). Steps 3-4 run after 1-2 (dependency on backend types). Steps 5-6 run parallel with everything (no file overlap). Step 7 independent.

---

## Rollback Plan

| Change | Rollback |
|--------|----------|
| `period` param in `analytics-hono.ts` | Remove `period` from schema + route logic; revert `summary.ts` to original. Default behavior unchanged. |
| `staff-performance` endpoint | Delete `staff-performance.ts` file + remove route from `analytics-hono.ts` + remove test cases. No impact on other endpoints. |
| RevenueChart period wiring | Revert `Dashboard.tsx` to `useDailyRevenue` hook; `usePeriodRevenue` becomes unused but harmless. |
| StaffPerformance component | Delete component file + remove from Dashboard. Dashboard renders without it. |
| Component tests | Delete test files. No production impact. |
| Hook tests | Delete test file. No production impact. |
| Sidebar entry | Revert `AdminSidebar.tsx` SECTIONS array to original 2-item array. |

---

## Unresolved Questions

1. **staff_shifts → orders linkage:** The `staff_shifts` table has no foreign key to orders. If live data shows staff can't be matched to orders via the proposed LEFT JOIN, we fall back to shift-count-only mode. Should we add `shift_id` to orders table? (requires migration — out of scope for analytics dashboard, but noted for future G4 push notifications work which already has `staff_id` in `push_subscriptions`.)

2. **StaffPerformance placement:** Should this widget go on the main Dashboard page or on a dedicated Analytics page? Currently planned for Dashboard. If user wants a clean `/admin/analytics` page, requires extracting chart widgets into a shared "AnalyticsDashboard" composable.

3. **Monthly data on Dashboard:** With default 30-day window, monthly view returns 1 row. Should Dashboard auto-expand to 365 days when period=monthly? Current plan says yes (step 3 above). Verify with user if they want a fixed 12-month view instead.

4. **PeriodComparisonChart data source:** SalesReports page uses `/api/reports/daily` for period comparison. Should the new `/api/analytics/?period=weekly` endpoint also support `?compare=true` for the PeriodComparisonChart? Currently `compare` is only implemented for `period=daily` in the summary route. Not blocking this phase.
