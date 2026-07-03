# Phase B: Operations, Analytics & Infrastructure Hardening

**Date:** 2026-07-03
**Status:** Planned
**Priority:** P1-P2 (see individual phases)
**Branch:** `main`
**Source Validation:** Multiple sources — brainstorm-260701-2156 observability (approved), docs/05_TASKS/ (story gaps), UI/UX Pro Max audit #11+#13 (remaining polish)
**Production:** https://auraspace.cafe
**Current tests:** 1184+ passing (committed), 0 TS errors

---

## Overview

Phase B covers 6 validated workstreams that harden the production system beyond Phase A's frontend remediation. After Stitch conversion, analytics dashboard, and UI/UX polish are complete, these items address the remaining gaps in operations visibility, sales intelligence, payment operations, and performance monitoring.

**Total estimated effort:** 40-53 hours

## Workstreams

| Phase | Name | Effort | Files Touched | Priority | Source |
|-------|------|--------|---------------|----------|--------|
| B1 | Observability & Alerting (Phases 1-2) | 6-8h | 8 create, 4 modify | P1 Critical | brainstorm-260701-2156 |
| B2 | Advanced Sales Reporting | 6-8h | 4 create, 3 modify | P1 High | docs/05_TASKS/admin.md Story 4 |
| B3 | Performance Monitoring & Web Vitals | 4-6h | 3 create, 2 modify | P2 Medium | docs/05_TASKS/infrastructure.md Story 6 |
| B4 | Audit Log Viewer | 10-12h | 6 create, 3 modify | P2 Medium | docs/05_TASKS/admin.md backlog |
| B5 | Refund Processing (PayOS) | 6-8h | 3 create, 3 modify | P1 High | docs/05_TASKS/payments.md Story 4 |
| B6 | Remaining UI Polish & Cleanup | 3-4h | 5 modify | P2 Low | UI/UX Audit #11, #13 |
| **Total** | | **40-53h** | **~40 files** | | |

## Architecture Impact

- **Database changes:** Yes — 3 new tables (B1: _metrics, _alerts; B4: audit_logs)
- **API changes:** Yes — 5 new endpoints (B1: metrics API; B2: sales reports; B4: audit-logs; B5: refund)
- **New components:** 5+ admin pages and dashboard widgets
- **No new packages:** All work uses existing dependencies (hono, zod, D1, Telegram)
- **No breaking changes:** All new endpoints are additive; existing contracts unchanged

## Dependency Graph

```
B1 ───┐
       ├──► B3 (metrics data feeds performance monitoring)
B4 ───┘ (audit hooks needed in existing middleware)
B2 ──► (enhances existing analytics endpoint)
B5 ──► (new refund flow, independent)
B6 ──► (independent CSS polish)
```

- B1 and B4 share patterns but are independent (both add middleware hooks)
- B3 depends on B1 metrics data for Web Vitals aggregation
- B2 enhances existing `/api/admin/metrics` endpoint with period comparison
- B5 is independent (new payment refund flow)
- B6 is independent (CSS cleanup)

## File Change Map

```
Worker Layer (B1, B2, B4, B5)
  worker/src/lib/metrics-collector.ts    ─── NEW: D1 metrics recorder
  worker/src/lib/alert-dispatcher.ts     ─── NEW: Telegram alert dispatch
  worker/src/routes/admin-metrics.ts     ─── NEW/ENHANCE: metrics query endpoint
  worker/src/routes/analytics-hono.ts    ─── ENHANCE: period comparison
  worker/src/routes/refunds.ts           ─── NEW: PayOS refund endpoints
  worker/src/middleware/logger.ts        ─── ENHANCE: metrics hooks + audit hooks
  worker/src/index.ts                    ─── ENHANCE: register new routes + cron
  worker/migrations/004_metrics_tables.sql ─── NEW: _metrics, _alerts, audit_logs

Frontend Layer (B1, B2, B4, B5, B6)
  src/pages/admin/Metrics.tsx            ─── ENHANCE: alert log display
  src/pages/admin/SalesReports.tsx       ─── NEW: period comparison page
  src/pages/admin/AuditLogViewer.tsx     ─── NEW: audit log browse/filter
  src/pages/admin/OrderDetail.tsx        ─── NEW/ENHANCE: refund button flow
  src/components/admin/RevenueChart.tsx  ─── ENHANCE: period overlay
  src/components/admin/TopProductsChart.tsx ── ENHANCE: date-range filter
  src/tree/analytics/use-sales-store.ts  ─── NEW: sales report Zustand store
  src/tree/audit/use-audit-store.ts      ─── NEW: audit log Zustand store
  src/tree/payments/use-refund-store.ts  ─── NEW: refund Zustand store
  src/pages/home.tsx                     ─── B6: section spacing fix
  src/components/home/five-zone-showcase.tsx ── B6: forest green tokens
  src/styles/brand-tokens.css            ─── B6: dead alias cleanup

Infrastructure
  scripts/apply-migrations.sh            ─── ENHANCE: include new migrations
  scripts/convert-to-webp.mjs            ─── B6: optimize remaining PNGs
```

## Detailed Plans

Each workstream has a dedicated plan document in this directory:

| Document | Workstream |
|----------|------------|
| `B1-observability-alerting.md` | Metrics collector + alert dispatcher |
| `B2-sales-reporting.md` | Advanced sales reports with period comparison |
| `B3-performance-monitoring.md` | Web Vitals + Lighthouse CI |
| `B4-audit-log-viewer.md` | Audit trail + admin viewer |
| `B5-refund-processing.md` | PayOS refund flow |
| `B6-ui-polish-cleanup.md` | Forest green tokens + dead code cleanup |

## Quality Gates

- [ ] `npm run build` = 0 TypeScript errors
- [ ] `npm test` = all existing tests pass (0 regression)
- [ ] Zero `:any` types in production code
- [ ] Zero `console.log` in production code
- [ ] New D1 migrations applied to production
- [ ] All new endpoints use Zod validation
- [ ] All new endpoints return bilingual VN+EN labels
- [ ] Bilingual error messages in admin UI

## Rollback Strategy

```bash
# Revert ALL Phase B changes
git checkout HEAD~40 -- src/ worker/ scripts/
npm run build
npm test
# Rollback D1 migrations
npx wrangler d1 execute AURA_DB --command "DROP TABLE IF EXISTS _metrics; DROP TABLE IF EXISTS _alerts; DROP TABLE IF EXISTS audit_logs;"
```
