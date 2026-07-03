# Phase B Deep Implementation Plan — Build Report

**Date:** 2026-07-03 18:52
**Status:** COMPLETE
**Total Planning Effort:** 40-53 hours across 6 workstreams
**Files Created:** 7 (1 master plan + 6 workstream plans)

---

## Summary

Deep implementation plans created for all 6 validated Phase B workstreams at `/Users/macbook/FnB-Container-Caffe/plans/260703-1849-aura-phase-b/`.

## Plan Files

| File | Size | Description |
|------|------|-------------|
| `plan.md` | Master plan with dependency graph, file change map, quality gates |
| `B1-observability-alerting.md` | Metrics collector + Telegram alert dispatcher |
| `B2-sales-reporting.md` | Advanced sales reports with period comparison + grouping |
| `B3-performance-monitoring.md` | Web Vitals + Lighthouse CI + API latency |
| `B4-audit-log-viewer.md` | Admin audit trail with filterable viewer |
| `B5-refund-processing.md` | PayOS refund flow with loyalty reversal |
| `B6-ui-polish-cleanup.md` | Forest green tokens + container padding fix |

## Source Validation

| Workstream | Source | Status |
|------------|--------|--------|
| B1 | brainstorm-260701-2156 (approved), phases 1-2 pending | Validated |
| B2 | docs/05_TASKS/admin.md Story 4 (partial) | Validated |
| B3 | docs/05_TASKS/infrastructure.md Story 6 (not impl) | Validated |
| B4 | docs/05_TASKS/admin.md backlog P2 12h | Validated |
| B5 | docs/05_TASKS/payments.md Story 4 (not impl) | Validated |
| B6 | UI/UX Pro Max audit #11, #13 | Validated |

## Key Design Decisions

1. **No new npm packages** (B1, B2, B4, B5, B6) — all use existing dependencies. B3 adds `web-vitals` only (~1KB gzipped).
2. **ctx.waitUntil for all D1 writes** — metrics, audit logs, and vitals are non-blocking (zero latency impact).
3. **Reuse B1 `_metrics` table for B3 Web Vitals** — single data source for observability.
4. **Middleware-based audit logging** (B4) — not per-route, reducing implementation surface.
5. **D1 schema changes are additive** — new tables (B1, B4) and ALTER TABLE ADD COLUMN (B5). No breaking changes.
6. **Bilingual VN+EN** — all new admin pages and API responses follow existing bilingual pattern.
7. **YAGNI applied** — No configurable alert thresholds UI (hardcoded), no custom dashboard builder (fixed widgets), no WebSocket for real-time admin notifications (polling sufficient).

## Database Changes (3 new tables + 1 migration)

| Migration | Table/Changes | Workstream |
|-----------|---------------|------------|
| `004_metrics_tables.sql` | `_metrics`, `_alerts` | B1 |
| `005_audit_logs.sql` | `audit_logs` | B4 |
| `006_refund_columns.sql` | `ALTER payments ADD COLUMN refund_*` | B5 |

## API Endpoints (7 new, 2 enhanced)

| Endpoint | Method | Workstream | Purpose |
|----------|--------|-----------|---------|
| `/api/admin/metrics?range=&compare=&group=` | GET | B1, B2 | Metrics query + comparison |
| `/api/cron/alert-dispatch` | POST | B1 | Cron alert dispatch |
| `/api/vitals` | POST | B3 | Web Vitals beacon |
| `/api/admin/audit-logs` | GET | B4 | Audit log query |
| `/api/admin/audit-logs/export` | GET | B4 | CSV export |
| `/api/payments/refund` | POST | B5 | Initiate refund |
| `/api/payments/refunds/:paymentId` | GET | B5 | Refund status |

## Frontend Components (5 new pages, 4 new widgets, 3 new stores)

| Component | Type | Workstream |
|-----------|------|------------|
| `AuditLogViewer.tsx` | Page | B4 |
| `SalesReports.tsx` | Page | B2 |
| `RefundModal` | Modal | B5 |
| `PeriodComparisonChart.tsx` | Widget | B2 |
| `GroupedSalesChart.tsx` | Widget | B2 |
| `PerformanceTab` | Section | B3 |
| `use-sales-store.ts` | Zustand | B2 |
| `use-audit-store.ts` | Zustand | B4 |
| `use-refund-store.ts` | Zustand | B5 |

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| D1 migration conflicts with existing migrations | All migrations use sequential numbering (004, 005, 006) |
| PayOS API changes | Refund endpoint has try/catch with graceful error response; test with sandbox first |
| Audit log storage growth (500 entries/day = 3MB/month) | Cron prune at 90 days, export before prune |
| Web Vitals beacon from all sessions (anonymous) | No PII in vitals data; aggregate-only storage |
| B4 audit middleware performance on busy routes | Writes via `ctx.waitUntil` — zero latency impact |

## Files Touched (Total: ~40 files)

- **Worker new:** 9 files (metrics-collector, alert-dispatcher, audit-logger, refunds route, vitals route, admin-audit-logs route, 3 migration files)
- **Worker modify:** 8 files (index.ts, logger.ts, analytics-hono.ts, payments.ts, auth.ts, orders-hono.ts, loyalty.ts)
- **Frontend new:** 5 pages + 4 widget components + 3 Zustand stores
- **Frontend modify:** 8 pages (padding fixes, nav links, order detail enhancements)
- **CSS:** 1 file (brand-tokens.css alias cleanup)
- **Infrastructure:** 1 file (Lighthouse CI workflow)

## Execution Order

Recommended execution:
1. **B1** first (foundation: metrics infrastructure enables B3)
2. **B4** parallel with B1 (audit middleware is independent)
3. **B2** after B1 (enhances existing analytics with comparison + grouping)
4. **B5** parallel (independent refund flow)
5. **B3** after B1 (reuses metrics table for Web Vitals storage)
6. **B6** anytime (independent CSS changes)
