---
phase: 2
title: "A2: Backend Customer Metrics + CSV Export"
status: pending
priority: P1
effort: 1h
mode: tdd
stream: A
---

# Phase A2: Backend Customer Metrics + CSV Export

## Overview

Add customer metrics endpoint + CSV export. TDD approach.

## Requirements

- `GET /api/analytics/customer-metrics` — total customers, new (30d), repeat rate, avg order value
- `GET /api/analytics/export?start=&end=` — CSV of all order data
- CSV returns `Content-Type: text/csv` with download headers

## Related Code Files

- Create: `worker/src/tree/analytics/customer-metrics.ts`
- Create: `worker/src/tree/analytics/csv-export.ts`
- Modify: `worker/src/routes/analytics-hono.ts`
- Modify: `worker/src/__tests__/analytics.test.ts`

## Implementation Steps

1. Write TDD tests for both endpoints
2. `customer-metrics.ts` — D1: aggregate customer stats
3. `csv-export.ts` — query orders + items, format CSV rows
4. Add routes to `analytics-hono.ts` with Zod validation
5. `npm test` + `npm run build`

## Success Criteria

- [ ] Tests pass before implementation
- [ ] Customer metrics returns correct stats
- [ ] CSV export returns valid CSV with proper Content-Type
- [ ] All 1,063+ existing tests pass
- [ ] `npm run build` — 0 errors
