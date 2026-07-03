# Phase B Detailed Implementation Plan — Van Hanh & Cung Co Ha Tang

**Date:** 2026-07-03
**Total Effort:** 40-53 hours
**Priority:** P1-P2 (see individual items)
**DB Changes:** 3 new tables + 1 ALTER TABLE
**API Changes:** 7 new endpoints, 2 enhanced
**New Packages:** web-vitals (~1KB gzipped) for B3 only

---

## B1: Observability & Alerting / Quan Sat & Canh Bao

**Effort:** 6-8 hours | **Priority:** P1 Critical | **Source:** brainstorm-260701-2156 (approved)
**Dependencies:** None (Phase A can be in progress or complete)
**Blocks:** B3 (performance monitoring depends on metrics infrastructure)

### Technical Design Overview / Thiet Ke Ky Thuat

Two-layer system: (1) middleware-based metrics collection writes to D1, (2) cron-triggered alert dispatcher checks thresholds and sends Telegram notifications.

```
Request Flow:
  logger.ts -> metrics-collector.ts (ctx.waitUntil -> D1 write)
                     |
  Cron (every 5min): |
  alert-dispatcher.ts <-- check thresholds against D1
       |
       +--> Telegram (revenue/infra/security alerts)
       +--> Telegram (daily digest at 21:00 ICT)
```

**Key principle:** All writes via `ctx.waitUntil` — zero latency impact on API responses.

### D1 Schema / Migration: `004_metrics_tables.sql`

```sql
CREATE TABLE IF NOT EXISTS _metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  value REAL NOT NULL,
  tags TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_metrics_name_ts ON _metrics(name, created_at);

CREATE TABLE IF NOT EXISTS _alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_key TEXT NOT NULL UNIQUE,
  severity TEXT NOT NULL CHECK(severity IN ('critical','warning','info')),
  message TEXT NOT NULL,
  details TEXT DEFAULT '{}',
  dispatched_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Files to Create

| File | Purpose |
|------|---------|
| `worker/src/lib/metrics-collector.ts` | recordMetric(), recordAlert(), pruneOldMetrics() |
| `worker/src/lib/alert-dispatcher.ts` | dispatchAlerts(), dispatchDigest(), threshold checks |
| `worker/migrations/004_metrics_tables.sql` | _metrics and _alerts tables |
| `worker/src/__tests__/lib/metrics-collector.test.ts` | Collector unit tests |
| `worker/src/__tests__/lib/alert-dispatcher.test.ts` | Dispatcher unit tests + Telegram mock |

### Files to Modify

| File | Change |
|------|--------|
| `worker/src/middleware/logger.ts` | Hook recordMetric() for every request |
| `worker/src/index.ts` | Register metrics route, cron alert dispatch |
| `worker/src/routes/payments.ts` | Emit payment_success, payment_failed, revenue metrics |
| `worker/src/routes/auth.ts` | Emit login_success, login_failed metrics |
| `worker/src/routes/orders-hono.ts` | Emit order_created metric |

### API Endpoints

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/api/admin/metrics?range=24h\|7d\|30d` | Aggregated metrics JSON | Staff |
| POST | `/api/cron/alert-dispatch` | Cron trigger: check thresholds + dispatch | Internal |

### Alert Thresholds

- **Revenue critical:** order stuck >15min in "preparing" status
- **Revenue warning:** payment webhook failure
- **Infra warning:** Worker 5xx rate >5%
- **Infra info:** D1 query latency >500ms
- **Security warning:** failed logins >10/min
- **Security info:** order volume anomaly (>3x hourly avg)

### Acceptance Criteria

- [ ] recordMetric() writes to _metrics table via ctx.waitUntil
- [ ] pruneOldMetrics(30) removes records older than 30 days
- [ ] Middleware automatically records request metrics
- [ ] Business routes emit order_created, payment_success, payment_failed metrics
- [ ] dispatchAlerts() checks thresholds and dispatches via Telegram
- [ ] Alert deduplication via alert_key unique constraint
- [ ] Daily digest dispatched at 21:00 ICT
- [ ] npm run build = 0 errors, npm test = all pass
- [ ] Migration applies cleanly to D1

### Estimated Hours

| Task | Hours |
|------|-------|
| D1 migration creation | 0.3 |
| metrics-collector.ts | 0.75 |
| Hook into logger.ts middleware | 0.25 |
| Hook into business routes | 0.33 |
| alert-dispatcher.ts (thresholds + cooldown) | 1.0 |
| Telegram dispatch + format | 0.5 |
| GET /api/admin/metrics endpoint | 0.5 |
| Register cron in index.ts | 0.25 |
| Write tests | 1.0 |
| Build + test verification | 0.33 |
| **Total** | **6-8h** |

---

## B2: Advanced Sales Reporting / Bao Cao Ban Hang Nang Cao

**Effort:** 6-8 hours | **Priority:** P1 High
**Source:** docs/05_TASKS/admin.md Story 4 (partial)

### Technical Design Overview

Extend existing `GET /api/admin/metrics` endpoint with period comparison and grouping. Add new admin page with period selector, chart widgets, and CSV export.

**No new tables** — all queries from existing orders, order_items, payments tables. KV cache with 30s TTL.

### Files to Create

| File | Purpose |
|------|---------|
| `src/pages/admin/SalesReports.tsx` | Period comparison page with chart widgets |
| `src/components/admin/PeriodComparisonChart.tsx` | Revenue comparison chart (current vs previous period) |
| `src/components/admin/GroupedSalesChart.tsx` | Grouped sales by hour/day/category/payment |

### Files to Modify

| File | Change |
|------|--------|
| `worker/src/routes/analytics-hono.ts` | Add compare=true, group params |
| `src/tree/analytics/use-analytics-store.ts` | Add comparison fields, period selector state |
| `src/pages/admin/Dashboard.tsx` | Add link to /admin/sales-reports |

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/metrics?range=7d&compare=true` | Current + previous period comparison |
| GET | `/api/admin/metrics?range=7d&group=hour` | Grouped data by dimension |
| GET | `/api/admin/sales/csv?range=7d` | CSV export with bilingual headers |

Query params: `range` (24h/7d/30d/custom), `start`/`end`, `compare` (true/false), `group` (hour/day/category/payment)

### Frontend Component States

- **Loading:** Skeleton while fetching
- **Empty:** "No sales data for this period" message
- **Error:** Retry button on fetch failure
- **Edge case:** Custom date range with validation (end >= start)

### Acceptance Criteria

- [ ] Period comparison: current vs previous period overlay on revenue chart
- [ ] Grouped sales: hourly, daily, category, payment method views
- [ ] Custom date range picker with validation
- [ ] CSV export with bilingual headers, date range in filename
- [ ] KV cache 30s TTL, invalidated on new order
- [ ] Loading, empty, error states all handled
- [ ] npm run build = 0 errors, npm test = all pass

### Estimated Hours

| Task | Hours |
|------|-------|
| Extend analytics-hono.ts with compare+group params | 1.5 |
| Write API tests | 0.5 |
| Extend use-analytics-store.ts | 0.33 |
| PeriodComparisonChart component | 1.0 |
| GroupedSalesChart component | 0.75 |
| SalesReports page | 1.0 |
| CSV export endpoint | 0.5 |
| Build + test verification | 0.33 |
| **Total** | **6-8h** |

---

## B3: Performance Monitoring & Web Vitals / Theo Doi Hieu Nang

**Effort:** 4-6 hours | **Priority:** P2 Medium
**Source:** docs/05_TASKS/infrastructure.md Story 6
**Dependencies:** B1 (reuses _metrics table for Web Vitals storage)

### Technical Design Overview

Three-prong approach: (1) Web Vitals via `web-vitals` library with beacon endpoint, (2) Lighthouse CI on PRs, (3) API response time monitoring via B1 metrics.

**No new tables** — reuses B1 `_metrics` table with naming prefix `web_vital_*`.

### Files to Create

| File | Purpose |
|------|---------|
| `worker/src/routes/vitals.ts` | POST /api/vitals beacon endpoint |
| `.github/workflows/lighthouse.yml` | Lighthouse CI on PR |
| `worker/src/__tests__/routes/vitals.test.ts` | Vitals endpoint tests |

### Files to Modify

| File | Change |
|------|--------|
| `src/App.tsx` or `src/main.tsx` | Init web-vitals library, beacon callback |
| `src/styles/global.css` | Add content-visibility: auto below-fold |
| `src/pages/admin/Metrics.tsx` | Add Performance tab with Web Vitals + API latency |

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/vitals` | Receive Web Vitals beacon (sendBeacon, non-blocking) |
| GET | `/api/admin/metrics?filter=web_vital_*&range=7d` | Query stored vitals (reuses B1) |

### Acceptance Criteria

- [ ] web-vitals library initialized, LCP/FID/CLS beaconed to POST /api/vitals
- [ ] Metrics stored in _metrics with prefix web_vital_*
- [ ] Performance tab shows vitals distribution (good/needs-improvement/poor)
- [ ] API P95 latency displayed (from B1 middleware)
- [ ] Lighthouse CI workflow for PR trigger (non-blocking)
- [ ] Target scores: Performance >= 90, A11y >= 95, Best Practices >= 90, SEO >= 95
- [ ] Beacon is non-blocking (sendBeacon, not fetch)

### Estimated Hours

| Task | Hours |
|------|-------|
| Install web-vitals, init with beacon | 0.5 |
| Build POST /api/vitals endpoint | 0.5 |
| Vitals endpoint tests | 0.33 |
| Add Performance tab to metrics page | 1.0 |
| Create Lighthouse CI workflow | 0.5 |
| CLS improvement CSS | 0.25 |
| Build + test verification | 0.33 |
| **Total** | **4-6h** |

---

## B4: Audit Log Viewer / Xem Nhat Ky Kiem Toan

**Effort:** 10-12 hours | **Priority:** P2 Medium
**Source:** docs/05_TASKS/admin.md backlog (P2, 12h estimated)

### Technical Design Overview

Middleware-based audit logging hooks into admin routes. New `audit_logs` D1 table. Admin page with browse/filter/search.

**Key design:** Middleware-based, not per-route. Pre/post state recording for order status + menu price changes. No PII in details. 90-day retention via cron.

### D1 Schema / Migration: `005_audit_logs.sql`

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details TEXT DEFAULT '{}',
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id, created_at);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
```

### Files to Create

| File | Purpose |
|------|---------|
| `worker/src/lib/audit-logger.ts` | AuditLogger class with log(), query(), prune() |
| `worker/src/routes/admin-audit-logs.ts` | GET /api/admin/audit-logs with filter/pagination |
| `src/pages/admin/AuditLogViewer.tsx` | Full page: filter panel + paginated table + CSV export |
| `src/tree/audit/use-audit-store.ts` | Zustand store for audit log state |
| `worker/migrations/005_audit_logs.sql` | audit_logs table |
| `worker/src/__tests__/lib/audit-logger.test.ts` | Logger unit tests |
| `worker/src/__tests__/routes/admin-audit-logs.test.ts` | API integration tests |

### Files to Modify

| File | Change |
|------|--------|
| `worker/src/middleware/logger.ts` | Add audit middleware wrapper for admin routes |
| `worker/src/index.ts` | Register audit route, cron prune |
| `src/pages/admin/AdminSidebar.tsx` | Add "Audit Log" nav item |

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/audit-logs` | Query audit logs with filters (date range, actor, action, resource type) |
| GET | `/api/admin/audit-logs/export` | CSV export of filtered results |

### Frontend States

- **Loading:** Skeleton rows (10 rows matching page size)
- **Empty:** "No audit logs match your filters" with reset button
- **Error:** "Failed to load audit logs" with retry button
- **Edge cases:** Single row, many rows, filtered to 0

### Acceptance Criteria

- [ ] Every admin action creates an audit entry (order status, menu edit, staff CRUD, promo edit, config change)
- [ ] Audit entry contains: actor, action, resource type, resource ID, timestamp, IP
- [ ] Pre/post state recorded for order status changes and menu price edits
- [ ] No PII in any audit entry
- [ ] Date range, actor, action, resource type filters all work
- [ ] Paginated results (50 per page)
- [ ] CSV export with filtered results
- [ ] Loading/empty/error states handled
- [ ] Page accessible only to owner role
- [ ] All writes via ctx.waitUntil (non-blocking)

### Estimated Hours

| Task | Hours |
|------|-------|
| D1 migration | 0.25 |
| AuditLogger class (log, query, prune) | 1.5 |
| Audit middleware hooks | 0.75 |
| Wire routes to emit audit events | 1.0 |
| GET /api/admin/audit-logs + export | 1.0 |
| use-audit-store Zustand store | 0.5 |
| AuditLogViewer page | 2.0 |
| Write tests | 1.0 |
| Build + test verification | 0.5 |
| **Total** | **10-12h** |

---

## B5: Refund Processing (PayOS) / Xu Ly Hoan Tien

**Effort:** 6-8 hours | **Priority:** P1 High
**Source:** docs/05_TASKS/payments.md Story 4 (not implemented)

### Technical Design Overview

Add refund endpoint calling PayOS refund API. Full and partial refund support. Loyalty point reversal on refund completion. Customer notification via existing channels.

### Database Changes / Migration: `006_refund_columns.sql`

```sql
ALTER TABLE payments ADD COLUMN refund_status TEXT DEFAULT NULL
  CHECK(refund_status IN (NULL, 'pending', 'processing', 'completed', 'failed'));
ALTER TABLE payments ADD COLUMN refund_amount INTEGER DEFAULT 0;
ALTER TABLE payments ADD COLUMN refund_reason TEXT DEFAULT NULL;
ALTER TABLE payments ADD COLUMN refunded_at TEXT DEFAULT NULL;
```

### Files to Create

| File | Purpose |
|------|---------|
| `worker/src/routes/refunds.ts` | POST /api/payments/refund, GET /api/payments/refunds/:paymentId |
| `src/tree/payments/use-refund-store.ts` | Zustand store for refund state |
| `worker/src/__tests__/routes/refunds.test.ts` | Refund endpoint tests |

### Files to Modify

| File | Change |
|------|--------|
| `worker/src/index.ts` | Register refund routes |
| `src/pages/admin/OrderDetail.tsx` | Add Refund button + modal to paid orders |
| `worker/src/routes/loyalty.ts` | Add deductPointsForRefund() function |

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/payments/refund` | Initiate refund (full or partial) |
| GET | `/api/payments/refunds/:paymentId` | Get refund status |

**POST body:**
```json
{ "paymentId": 1234, "amount": 50000, "reason": "Customer cancelled" }
```

**Error responses (bilingual VN+EN):**
- AMOUNT_EXCEEDS_PAYMENT: "So tien hoan vuot qua so tien da thanh toan"
- PAYMENT_ALREADY_REFUNDED: "Don hang da duoc hoan tien truoc do"
- PAYOS_API_ERROR: "Loi tu PayOS: ..." (retryable: true)

### Frontend States

- **Loading:** Disabled button with spinner while processing
- **Success:** Green banner with refund ID, order status updated
- **Error:** Inline error with retry button (for retryable) or "Contact support"
- **Edge case:** Partial refund remaining balance shown to staff
- **Edge case:** Network timeout -> refund status set to "pending" until webhook confirms

### Acceptance Criteria

- [ ] Full and partial refund supported
- [ ] PayOS API called correctly with amount and reason
- [ ] Refund status tracked: pending -> processing -> completed -> failed
- [ ] Duplicate refund request rejected (idempotent)
- [ ] Loyalty points deducted on refund completion
- [ ] Customer notification sent via existing channels
- [ ] Refund button visible on paid orders (owner/manager role)
- [ ] Refund modal with amount field, reason textarea, confirm/cancel
- [ ] Loading/error/success states handled
- [ ] Zod validation on all refund inputs

### Estimated Hours

| Task | Hours |
|------|-------|
| D1 migration (alter payments table) | 0.25 |
| POST /api/payments/refund endpoint | 1.5 |
| GET /api/payments/refunds/:paymentId | 0.5 |
| Loyalty point deduction on refund | 0.5 |
| use-refund-store | 0.33 |
| RefundModal + OrderDetail integration | 1.0 |
| Customer notification wiring | 0.5 |
| Write tests | 1.0 |
| Build + test verification | 0.33 |
| **Total** | **6-8h** |

---

## B6: Remaining UI Polish & Cleanup / Hoan Thien Giao Dien

**Effort:** 2-3 hours | **Priority:** P2 Low
**Source:** UI/UX Audit #11 (forest green tokens unused), #13 (container padding)

### Technical Design Overview

Two minor fixes: (1) integrate unused forest green tokens into FiveZoneShowcase Jade Counter zone, (2) fix container padding from px-4 to px-6 on all customer-facing pages.

### Files to Modify

| File | Change |
|------|--------|
| `src/components/home/five-zone-showcase.tsx` | Apply forest green tokens to Jade Counter zone |
| `src/pages/home.tsx` | px-4 -> px-4 md:px-6 |
| `src/pages/AboutUs.tsx` | px-4 -> px-4 md:px-6 |
| `src/pages/Contact.tsx` | px-4 -> px-4 md:px-6 |
| `src/pages/ReviewsPage.tsx` | px-4 -> px-4 md:px-6 |
| `src/pages/loyalty.tsx` | Verify and fix container padding |
| `src/pages/referral.tsx` | Verify and fix container padding |
| `src/pages/events.tsx` | Verify and fix container padding |
| `src/styles/brand-tokens.css` | Clean up remaining gold aliases |

### Acceptance Criteria

- [ ] FiveZoneShowcase Jade Counter uses --aura-forest-* CSS variables
- [ ] Zero unreferenced forest tokens remain
- [ ] All customer-facing pages use px-4 md:px-6 for container padding
- [ ] Padding on 1280px viewport = 24px matching DESIGN.md
- [ ] Zero visual regression on 1024px+ viewports (no horizontal overflow)
- [ ] npm run build = 0 errors

### Estimated Hours

| Task | Hours |
|------|-------|
| Forest green tokens in FiveZoneShowcase | 0.33 |
| Home page padding fix | 0.15 |
| About Us, Contact, Reviews padding | 0.25 |
| Loyalty, Referral, Events padding | 0.25 |
| Dead alias cleanup | 0.15 |
| Visual verification across 3 viewports | 0.3 |
| Build + test verification | 0.25 |
| **Total** | **2-3h** |

---

## Phase B Execution Order / Thu Tu Thuc Hien

```
W5:  B1 (foundation — metrics infrastructure)
     B4 (parallel — audit logs independent)
W6:  B2 (enhances existing analytics)
     B5 (parallel — independent refund flow)
W7:  B4 continued (if needed)
W8:  B3 (after B1, reuses _metrics table)
     B6 (anytime — independent CSS)
```

## Phase B Quality Gates Summary

| Gate | Standard |
|------|----------|
| Build | `npm run build` = 0 TypeScript errors |
| Tests | `npm test` = all existing pass, new tests pass |
| Types | Zero `:any` types |
| Logs | Zero `console.log` in production |
| DB | All D1 migrations apply cleanly |
| API | All new endpoints use Zod validation |
| i18n | All new API responses and admin pages bilingual VN+EN |
| Performance | All D1 writes via ctx.waitUntil (non-blocking) |
