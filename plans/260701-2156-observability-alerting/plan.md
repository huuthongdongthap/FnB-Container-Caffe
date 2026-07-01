---
title: "Observability + Alerting for AURA CAFE"
description: "Middleware-based metrics collection, D1 time-series storage, Telegram alerting for revenue/infra/security events, admin metrics dashboard in React SPA. Zero external dependencies, Cloudflare free tier."
status: completed
priority: P2
branch: "main"
tags: [observability, metrics, alerting, telegram, dashboard, tdd]
blockedBy: []
blocks: []
created: "2026-07-01T15:03:36.449Z"
createdBy: "ck:plan"
source: skill
sourceReport: "plans/reports/brainstorm-260701-2156-observability-alerting.md"
mode: tdd
effort: 10-14h
---

# Observability + Alerting for AURA CAFE

## Overview

AURA CAFE v3.1.0 has zero observability beyond `console.log` in Cloudflare logs. No metrics, no alerting, no dashboard. This plan adds middleware-based metrics collection, D1 time-series storage, Telegram alerting for revenue-critical + infrastructure + security events, and a built-in admin dashboard — all within Cloudflare free tier, zero new dependencies.

**Source:** `plans/reports/brainstorm-260701-2156-observability-alerting.md`

## Key Numbers

| Metric | Target |
|--------|--------|
| New files | 7 (~400 lines) |
| Modified files | 4 |
| New DB tables | 2 (`_metrics`, `_alerts`) |
| New npm deps | 0 |
| Alert categories | 4 (revenue, infra, security, daily digest) |
| Dashboard views | 3 (24h, 7d, 30d) |
| Test files | 3 |

## Architecture

```
Worker Request Flow:
  logger.ts ──> metrics-collector.ts (ctx.waitUntil → D1 write)
                     │
  Cron (every 5min): │
  alert-dispatcher.ts ←── check thresholds against D1
       │
       ├──> Telegram (revenue/infra/security alerts)
       └──> Telegram (daily digest at 21:00 ICT)

Dashboard:
  React SPA → /api/admin/metrics?range=7d → Worker → D1 _metrics → JSON
```

## Phases

| Phase | Name | Status | Priority | Deps |
|-------|------|--------|----------|------|
| 1 | [DB Schema + Metrics Collector](./phase-01-db-schema-metrics-collector.md) | Pending | P1 | — |
| 2 | [Metrics API + Alert Dispatcher](./phase-02-metrics-api-alert-dispatcher.md) | Pending | P1 | 1 |
| 3 | [Admin Dashboard](./phase-03-admin-dashboard.md) | Completed | P2 | 2 |
| 4 | [Tests + Verify](./phase-04-tests-verify.md) | Completed | P1 | 3 |

## Dependencies

None. No cross-plan conflicts.

## Success Criteria

- [ ] Revenue-critical alerts fire within 5 min of trigger (order stuck, payment failure, 5xx spike)
- [ ] Infrastructure alerts fire for D1 latency >500ms, KV failures
- [ ] Security alerts fire for failed logins >10/min, order anomalies
- [ ] Daily digest sent to Telegram at 21:00 ICT with orders, revenue, errors
- [ ] `/admin/metrics` dashboard shows 24h/7d/30d views, staff-only access
- [ ] 0 new npm dependencies
- [ ] All existing 102 tests still pass (no regressions)
- [ ] `npx tsc --noEmit` exits 0
