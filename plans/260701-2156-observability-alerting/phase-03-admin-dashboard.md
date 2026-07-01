---
phase: 3
title: "Admin Dashboard"
status: completed
priority: P2
dependencies: [2]
effort: 2-3h
---

# Phase 3: Admin Dashboard

## Overview

Build a React SPA admin dashboard at `/admin/metrics` using the existing Pages frontend stack. Displays 24h, 7d, and 30d metrics views with order counts, revenue, error rates, and latency percentiles. Uses Zustand store for state. Staff-only access. Zero new npm dependencies.

**Pre-implementation scout:** Verify existing admin auth guard pattern before coding. Read current admin pages for auth pattern (layout, middleware, or getServerSideProps). Match the existing pattern exactly.

## TDD Structure

```
Step 3-T: Write tests for dashboard components (unit)
Step 10: Create Zustand metrics store
Step 11: Build metric cards (orders, revenue, errors, latency)
Step 12: Build range selector (24h / 7d / 30d tabs)
Step 13: Build chart components (time-series line charts)
Step 14: Wire to /api/admin/metrics endpoint
Step 15: Add route + auth guard in Pages router
```

## Requirements

- Functional: Dashboard at `/admin/metrics` shows metric cards + time-series charts
- Functional: Range selector toggles between 24h, 7d, 30d views
- Functional: Metric cards show: total orders, revenue, error count, success rate %, latency p50/p95
- Functional: Time-series chart shows request volume over selected range
- Functional: Dashboard auto-refreshes every 60s
- Functional: Staff-only access (same auth guard as other admin pages)
- Functional: Responsive layout (works on mobile + desktop)
- Non-functional: All data fetched from `/api/admin/metrics` (Phase 2 endpoint)
- Non-functional: Zero new npm dependencies (use existing React + Zustand + CSS)
- Non-functional: Skeleton loading states while fetching data

## Architecture

```
Pages (React SPA):
  /admin/metrics
    ├── MetricsDashboard (page component)
    │   ├── RangeSelector (24h | 7d | 30d tabs)
    │   ├── MetricCards (4 cards in grid)
    │   │   ├── OrderCard (total orders)
    │   │   ├── RevenueCard (total revenue)
    │   │   ├── ErrorCard (error count + rate)
    │   │   └── LatencyCard (p50 / p95 ms)
    │   └── RequestChart (time-series line chart)
    │
    └── useMetricsStore (Zustand)
        ├── fetchMetrics(range)
        ├── metrics data
        ├── loading state
        └── error state

Data flow:
  useMetricsStore.fetchMetrics('7d')
    → GET /api/admin/metrics?range=7d
    → Worker: query D1 _metrics, aggregate
    → JSON response
    → Zustand store update
    → React re-render cards + chart
```

## Related Code Files

| Action | File |
|--------|------|
| Create | `src/pages/admin/metrics-dashboard.tsx` |
| Create | `src/tree/metrics/use-metrics-store.ts` |
| Create | `src/components/admin/metric-cards.tsx` |
| Create | `src/components/admin/range-selector.tsx` |
| Create | `src/components/admin/request-chart.tsx` |
| Create | `src/__tests__/pages/admin/metrics-dashboard.test.tsx` |
| Create | `src/__tests__/tree/metrics/use-metrics-store.test.ts` |

## Implementation Steps

### Step 3-T: Write tests first (TDD)

```typescript
// src/__tests__/tree/metrics/use-metrics-store.test.ts
describe('useMetricsStore', () => {
  it('fetchMetrics sets loading=true while fetching');
  it('fetchMetrics populates data on successful response');
  it('fetchMetrics sets error on failed response');
  it('fetchMetrics does not refetch when range unchanged (cache)');
  it('default range is 24h');
});

// src/__tests__/pages/admin/metrics-dashboard.test.tsx
describe('MetricsDashboard', () => {
  it('renders 4 metric cards');
  it('renders range selector with 3 tabs');
  it('renders request chart');
  it('shows loading skeletons when fetching');
  it('shows error message on fetch failure');
  it('calls fetchMetrics on range change');
});
```

### Step 10: Create Zustand metrics store

File: `src/tree/metrics/use-metrics-store.ts`

```typescript
import { create } from 'zustand';

interface MetricsData {
  range: string;
  generated_at: string;
  requests: { total: number };
  errors: { total: number };
  orders: { total: number };
  revenue: { total: number };
  latency: { p50: number; p95: number };
  topPaths: Array<{ path: string; count: number }>;
}

interface MetricsState {
  range: '24h' | '7d' | '30d';
  data: MetricsData | null;
  loading: boolean;
  error: string | null;
  lastFetched: Record<string, number>; // range → timestamp for cache
  setRange: (range: '24h' | '7d' | '30d') => void;
  fetchMetrics: () => Promise<void>;
}

const CACHE_TTL = 60_000; // 1 minute cache

export const useMetricsStore = create<MetricsState>((set, get) => ({
  range: '24h',
  data: null,
  loading: false,
  error: null,
  lastFetched: {},

  setRange: (range) => {
    set({ range, error: null });
    get().fetchMetrics();
  },

  fetchMetrics: async () => {
    const { range, lastFetched, data } = get();
    // Skip if cached within TTL
    const lastFetch = lastFetched[range];
    if (data?.range === range && lastFetch && Date.now() - lastFetch < CACHE_TTL) {
      return;
    }

    set({ loading: true, error: null });
    try {
      const res = await fetch(`/api/admin/metrics?range=${range}`);
      if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch metrics');
      const json: MetricsData = await res.json();
      set({
        data: json,
        loading: false,
        lastFetched: { ...lastFetched, [range]: Date.now() },
      });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },
}));
```

### Step 11: Build metric cards

File: `src/components/admin/metric-cards.tsx`

```typescript
import { useMetricsStore } from '@/tree/metrics/use-metrics-store';

export function MetricCards() {
  const { data, loading } = useMetricsStore();
  if (loading && !data) return <MetricCardsSkeleton />;

  const orders = data?.orders?.total ?? 0;
  const revenue = data?.revenue?.total ?? 0;
  const errors = data?.errors?.total ?? 0;
  const totalReqs = data?.requests?.total ?? 0;
  const successRate = totalReqs > 0 ? ((1 - errors / totalReqs) * 100).toFixed(1) : '100';
  const { p50 = 0, p95 = 0 } = data?.latency ?? {};

  return (
    <div className="metrics-grid">
      <MetricCard label="Orders" value={orders} icon="🛒" />
      <MetricCard label="Revenue" value={`${(revenue / 1000).toFixed(1)}K VND`} icon="💰" />
      <MetricCard label="Success Rate" value={`${successRate}%`} icon="✅" />
      <MetricCard label="Latency" value={`p50: ${Math.round(p50)}ms / p95: ${Math.round(p95)}ms`} icon="⚡" />
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="metric-card">
      <span className="metric-icon">{icon}</span>
      <div>
        <div className="metric-label">{label}</div>
        <div className="metric-value">{value}</div>
      </div>
    </div>
  );
}

function MetricCardsSkeleton() {
  return (
    <div className="metrics-grid">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="metric-card skeleton" />
      ))}
    </div>
  );
}
```

### Step 12: Build range selector

File: `src/components/admin/range-selector.tsx`

```typescript
import { useMetricsStore } from '@/tree/metrics/use-metrics-store';

const RANGES = [
  { key: '24h' as const, label: '24 Hours' },
  { key: '7d' as const, label: '7 Days' },
  { key: '30d' as const, label: '30 Days' },
];

export function RangeSelector() {
  const { range, setRange } = useMetricsStore();
  return (
    <div className="range-selector">
      {RANGES.map((r) => (
        <button
          key={r.key}
          className={`range-tab ${range === r.key ? 'active' : ''}`}
          onClick={() => setRange(r.key)}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
```

### Step 13: Build request chart (SVG line chart, no deps)

File: `src/components/admin/request-chart.tsx`

```typescript
import { useMetricsStore } from '@/tree/metrics/use-metrics-store';

export function RequestChart() {
  const { data, loading } = useMetricsStore();
  if (loading || !data) return <div className="chart-placeholder">Loading chart...</div>;

  const paths = data.topPaths ?? [];
  const maxCount = Math.max(1, ...paths.map((p) => p.count));

  return (
    <div className="chart-container">
      <h3>Top Request Paths</h3>
      <div className="bar-chart">
        {paths.slice(0, 10).map((p) => (
          <div key={p.path} className="bar-row">
            <span className="bar-label" title={p.path}>{p.path}</span>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: `${(p.count / maxCount) * 100}%` }}
              />
            </div>
            <span className="bar-count">{p.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Step 14: Wire to /api/admin/metrics

Already wired via `useMetricsStore.fetchMetrics()` → `fetch('/api/admin/metrics?range=...')`. No additional wiring needed. Ensure CORS allows the Pages origin.

### Step 15: Add route + auth guard

Add the route to the Pages router at `src/pages/admin/metrics-dashboard.tsx`:

```typescript
import { useEffect } from 'react';
import { useMetricsStore } from '@/tree/metrics/use-metrics-store';
import { MetricCards } from '@/components/admin/metric-cards';
import { RangeSelector } from '@/components/admin/range-selector';
import { RequestChart } from '@/components/admin/request-chart';

export default function MetricsDashboardPage() {
  const { fetchMetrics, loading, error } = useMetricsStore();

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 60_000); // auto-refresh 60s
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  return (
    <div className="metrics-dashboard">
      <h1>📊 Metrics Dashboard</h1>
      <RangeSelector />
      {error && <div className="error-banner">{error}</div>}
      <MetricCards />
      <RequestChart />
      {loading && <div className="refresh-indicator">Refreshing...</div>}
    </div>
  );
}
```

Auth guard: The Pages layout/route already wraps admin pages with staff-auth check. Reuse the existing middleware pattern (e.g., `getServerSideProps` or layout auth check) consistent with other `/admin/*` pages.

## Success Criteria

- [ ] `/admin/metrics` renders 4 metric cards with correct data
- [ ] Range tabs (24h / 7d / 30d) switch data on click
- [ ] Cards show skeleton loading on initial fetch
- [ ] Error banner shows on API failure
- [ ] Dashboard auto-refreshes every 60s
- [ ] Bar chart renders top 10 request paths
- [ ] Dashboard is responsive on mobile viewport
- [ ] Staff-only access (non-staff sees 401 error)
- [ ] All dashboard component + store tests pass
- [ ] All existing tests still pass

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Chart rendering slow with many data points | Limit to top 10 paths; aggregate by hour/day bucket |
| Auto-refresh causes unnecessary D1 reads | Client-side cache (60s TTL in Zustand store) |
| Admin page accessible without auth | Reuse existing admin layout auth guard |
| CSS conflicts with existing admin styles | Use `metrics-` prefixed class names + scoped component styles |
