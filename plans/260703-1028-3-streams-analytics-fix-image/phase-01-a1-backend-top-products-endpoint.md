---
phase: 1
title: "A1: Backend Top-Products + Peak-Hours Endpoints"
status: pending
priority: P1
effort: 1h
mode: tdd
stream: A
---

# Phase A1: Backend Top-Products + Peak-Hours Endpoints

## Overview

Create two new D1-backed API endpoints: `GET /api/analytics/top-products` and `GET /api/analytics/peak-hours`. TDD: write tests for expected contracts first.

## Requirements

- `GET /api/analytics/top-products?limit=10` — top N products by order count + revenue
- `GET /api/analytics/peak-hours?days=30` — orders grouped by hour of day
- Zod validation on all inputs/outputs
- KV cache with 5-min TTL

## Related Code Files

- Create: `worker/src/routes/analytics-hono.ts`
- Create: `worker/src/tree/analytics/top-products.ts`
- Create: `worker/src/tree/analytics/peak-hours.ts`
- Modify: `worker/src/index.ts` (register route)
- Create: `worker/src/__tests__/analytics.test.ts`

## Implementation Steps

1. Write TDD tests for both endpoint contracts
2. Create `top-products.ts` — D1: `SELECT ... FROM order_items ... GROUP BY ... ORDER BY count DESC`
3. Create `peak-hours.ts` — D1: `SELECT strftime('%H', created_at) ... GROUP BY hour`
4. Create `analytics-hono.ts` — Hono router + Zod + KV caching
5. Register in `worker/src/index.ts`
6. `npm test` + `npm run build`

## Success Criteria

- [ ] Tests written and passing before implementation
- [ ] Top-products endpoint returns correct ranking
- [ ] Peak-hours returns correct 24h distribution
- [ ] KV cache reduces D1 queries on repeat calls
- [ ] All 1,063+ existing tests pass
- [ ] `npm run build` — 0 errors
