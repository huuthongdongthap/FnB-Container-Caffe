---
title: "Real Analytics Dashboard"
description: "Wire admin dashboard to real D1 data — revenue chart, top products, peak hours, customer metrics, CSV export"
date: 2026-07-02
status: complete
priority: P1
effort: 4h
mode: tdd
branch: main
tags: [analytics, dashboard, reports, d1]
source: plans/reports/brainstorm-260702-1532-analytics-dashboard-report.md
---

# Real Analytics Dashboard

**Goal:** Replace mock chart data on admin dashboard with real D1 queries. Add top products, peak hours, customer metrics, and CSV export.

**Approach:** 5 phases, TDD per phase (write tests for existing behavior before refactoring backend, then implement).

## Phases

| # | Phase | Effort | Status | TDD |
|---|-------|--------|--------|-----|
| 1 | Backend: top-products + peak-hours endpoints | 1h | pending | ✅ Tests first |
| 2 | Backend: customer metrics + CSV export | 1h | pending | ✅ Tests first |
| 3 | Frontend: real data hooks + RevenueChart wiring | 1h | pending | ❌ Frontend only |
| 4 | Frontend: TopProductsChart + PeakHoursChart | 0.5h | pending | ❌ Frontend only |
| 5 | Frontend: CustomerMetrics + Export + Dashboard integration | 0.5h | pending | ❌ Frontend only |

**Total:** ~4h

**Key constraint:** Zero regression on 1,033 existing tests. No breaking changes to existing API contracts.

## Sources

- Brainstorm report: `plans/reports/brainstorm-260702-1532-analytics-dashboard-report.md`
