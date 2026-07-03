# B1: Observability & Alerting (Phases 1-2)

**Date:** 2026-07-03
**Status:** Planned
**Priority:** P1 Critical
**Source:** brainstorm-260701-2156 (approved), plan at `plans/260701-2156-observability-alerting/phase-01-db-schema-metrics-collector.md` and `phase-02-metrics-api-alert-dispatcher.md`
**Effort:** 6-8 hours
**Dependencies:** None (based on prior plan with Phase 3 dashboard already completed via analytics work)
**Blocks:** B3 (performance monitoring depends on metrics infrastructure)

---

## 1. Technical Design

### Problem Statement

AURA CAFE has zero production observability beyond Cloudflare dashboard logs. No metrics collection, no alerting for revenue-critical failures, no automatic detection of stuck orders, payment failures, or infrastructure degradation. The admin analytics dashboard (completed in Stream A) provides historical charts but no real-time alerting.

### Architecture

Two-layer system: (1) middleware-based metrics collection writes to D1, (2) cron-triggered alert dispatcher checks thresholds and sends Telegram notifications.

```
Request Flow:
  logger.ts ──> metrics-collector.ts (ctx.waitUntil → D1 write)
                     │
  Cron (every 5min): │
  alert-dispatcher.ts ←── check thresholds against D1
       │
       ├──> Telegram (revenue/infra/security alerts)
       └──> Telegram (daily digest at 21:00 ICT)

Dashboard:
  Existing admin metrics page → GET /api/admin/metrics?range=24h|7d|30d
```

### D1 Schema

```sql
CREATE TABLE IF NOT EXISTS _metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,              -- e.g. 'order_created', 'payment_success'
  value REAL NOT NULL,             -- numeric value (amount, count, duration_ms)
  tags TEXT DEFAULT '{}',          -- JSON: {path, method, status, table_id, ...}
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_metrics_name_ts ON _metrics(name, created_at);

CREATE TABLE IF NOT EXISTS _alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_key TEXT NOT NULL UNIQUE,  -- deduplication key
  severity TEXT NOT NULL CHECK(severity IN ('critical','warning','info')),
  message TEXT NOT NULL,
  details TEXT DEFAULT '{}',
  dispatched_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Key Design Decisions

1. **ctx.waitUntil for metrics writes** — All D1 writes happen after response is sent. Zero impact on API latency.

2. **Alert key deduplication** — `alert_key` with `ON CONFLICT IGNORE` prevents duplicate alerts within same check cycle. Check-and-clear after dispatch.

3. **Cron-driven dispatch** — `alert-dispatcher.ts` runs every 5 minutes via cron route. Thresholds are hardcoded (no UI for now — YAGNI).

4. **Thresholds:**
   - Revenue: order stuck >15min in `preparing`, payment webhook failure, Worker 5xx rate >5%
   - Infrastructure: D1 query latency >500ms, KV read failures, Worker CPU >30ms
   - Security: failed logins >10/min, order volume anomaly (>3x hourly avg)

5. **Existing Telegram bot** — Reuses existing `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` env vars.

---

## 2. File List

### Files to Create

| File | Purpose |
|------|---------|
| `worker/src/lib/metrics-collector.ts` | `recordMetric()`, `recordAlert()`, `pruneOldMetrics()` |
| `worker/src/lib/alert-dispatcher.ts` | `dispatchAlerts()`, `dispatchDigest()`, threshold checks |
| `worker/migrations/004_metrics_tables.sql` | `_metrics` and `_alerts` tables |
| `worker/src/__tests__/lib/metrics-collector.test.ts` | Unit tests for collector |
| `worker/src/__tests__/lib/alert-dispatcher.test.ts` | Unit tests for dispatcher + Telegram mock |

### Files to Modify

| File | Change |
|------|--------|
| `worker/src/middleware/logger.ts` | Hook `recordMetric()` for every request (method, path, status, duration) |
| `worker/src/index.ts` | Register `GET /api/admin/metrics` route, cron alert dispatch |
| `worker/src/routes/payments.ts` | Emit `payment_success`, `payment_failed`, `revenue` metrics |
| `worker/src/routes/auth.ts` | Emit `login_success`, `login_failed` metrics |
| `worker/src/routes/orders-hono.ts` | Emit `order_created` metric |

---

## 3. Database Changes

### Migration: `004_metrics_tables.sql`

- `_metrics` table — time-series metric storage
- `_alerts` table — deduplicated alert log
- Indexes: `idx_metrics_name_ts` on (name, created_at)

### Data Retention

- Metrics: pruned after 30 days via cron (`pruneOldMetrics(30)`)
- Alerts: kept indefinitely (low volume, ~50/day max)

---

## 4. API Endpoints

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/api/admin/metrics?range=24h\|7d\|30d` | Aggregated metrics JSON | Staff |
| POST | `/api/cron/alert-dispatch` | Cron trigger: check thresholds + dispatch | Internal |

The metrics endpoint returns:
```json
{
  "order_volume": { "current": 127, "previous": 98, "change_pct": 29.6 },
  "revenue": { "current": 4850000, "previous": 3200000, "change_pct": 51.6 },
  "error_rate": { "current": 0.8, "threshold": 5.0, "status": "ok" },
  "d1_latency_p95": 245,
  "active_users_24h": 89,
  "top_paths": [ { "path": "/api/menu", "count": 1204 } ]
}
```

---

## 5. Frontend Components

No new frontend components. The existing admin metrics dashboard (`src/pages/admin/Metrics.tsx` / analytics dashboard) can be enhanced to show:
- Recent alerts log (latest 20 alerts, severity color-coded)
- Alert toggle test button (for manual testing)

---

## 6. Tests

| Test | File | What to verify |
|------|------|----------------|
| Metrics collector unit | `worker/src/__tests__/lib/metrics-collector.test.ts` | `recordMetric` writes correct data, `recordAlert` deduplicates, `pruneOldMetrics` works |
| Alert dispatcher unit | `worker/src/__tests__/lib/alert-dispatcher.test.ts` | Threshold checks fire correctly, cooldown respected, Telegram message format |
| Integration | Manual verify | D1 stores metrics, cron triggers alert, alert appears in Telegram |

---

## 7. Acceptance Criteria

### Metrics Collection
- [ ] `recordMetric(name, value, tags)` writes to `_metrics` table via `ctx.waitUntil`
- [ ] `pruneOldMetrics(30)` removes records older than 30 days
- [ ] Middleware automatically records request metrics (method, path, status, duration)
- [ ] Business routes emit `order_created`, `payment_success`, `payment_failed`, `revenue`, `login_failed` metrics

### Alerting
- [ ] `dispatchAlerts()` checks all defined thresholds and dispatches via Telegram
- [ ] Alert deduplication using `alert_key` unique constraint (5min critical, 30min warning cooldown)
- [ ] Daily digest dispatched at 21:00 ICT with orders/revenue/errors summary
- [ ] `POST /api/cron/alert-dispatch` exits cleanly when no alerts (no errors)

### Quality Gates
- [ ] `npm run build` = 0 errors
- [ ] `npm test` = all tests pass
- [ ] Migration `004_metrics_tables.sql` applies cleanly to D1
- [ ] Zero new npm dependencies
- [ ] Zero change to request response path (all writes via `waitUntil`)

---

## 8. Rollback Plan

```bash
# Revert code changes
git checkout HEAD -- worker/src/lib/metrics-collector.ts worker/src/lib/alert-dispatcher.ts

# Drop migration
npx wrangler d1 execute AURA_DB --command "DROP TABLE IF EXISTS _metrics; DROP TABLE IF EXISTS _alerts;"
```

---

## 9. Estimated Effort

| Task | Time |
|------|------|
| Create D1 migration | 20 min |
| Build metrics-collector.ts (recordMetric, recordAlert, pruneOldMetrics) | 45 min |
| Hook into logger.ts middleware | 15 min |
| Hook into business routes (payments, auth, orders) | 20 min |
| Build alert-dispatcher.ts (threshold checks + cooldown) | 1h |
| Build Telegram dispatch + format | 30 min |
| Build GET /api/admin/metrics?range=24h\|7d\|30d | 30 min |
| Register cron trigger in index.ts | 15 min |
| Write tests (metrics-collector + alert-dispatcher) | 1h |
| Build + test verification | 20 min |
| **Total** | **~6h** |
