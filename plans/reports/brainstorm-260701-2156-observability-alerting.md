# Brainstorm Report — Observability + Alerting for AURA CAFE

**Date:** 2026-07-01 | **Mode:** Deep + Parallel | **Flags:** --deep --parallel

## Problem Statement

AURA CAFE v3.1.0 runs on Cloudflare Workers + D1 + KV. Production traffic flows through order→payment→kitchen→loyalty paths. Zero observability beyond `console.log` in Cloudflare logs. No alerting for revenue-critical failures. No metrics dashboard. Operator has no visibility into system health without manually checking Cloudflare dashboard.

**Risk exposure:** TECH-01 (D1 connection limits, score 8), TECH-03 (KV quota, score 6), TECH-05 (API downtime, score 6).

## Requirements (Concrete)

### Expected Output
1. Admin metrics dashboard page at `/admin/metrics` in React SPA
2. Worker `/api/admin/metrics` endpoint returning aggregated time-series metrics
3. Telegram bot alerts for revenue-critical, infrastructure, and security events
4. Daily Telegram digest (orders, revenue, new customers, errors) at 21:00 ICT
5. Metrics collector library in worker middleware stack

### Acceptance Criteria
- Revenue alerts fire within 5 min: order stuck >15min, payment webhook failure, Worker 5xx rate >5%
- Infrastructure alerts: D1 query latency >500ms, KV read failures, Worker CPU >30ms
- Security alerts: failed logins >10/min, order volume anomaly (>3x hourly avg)
- Daily digest contains: total orders, revenue, new customers, top items, error count, D1/KV health
- Dashboard shows: order volume, revenue, error rate, D1 latency, active users (24h/7d/30d views)
- Zero additional hosting cost (Cloudflare free tier + existing Telegram bot)
- Dashboard accessible only to owner/staff roles

### Scope Boundary
- **IN:** Worker metrics collection, Telegram alert dispatch, admin dashboard page, daily digest cron, D1-based time-series storage
- **OUT:** External SaaS (Grafana Cloud, Sentry, PostHog, Datadog), mobile push notifications, multi-tenant metrics, custom alert rules UI, log search/query

### Non-Negotiable Constraints
- Must fit within Cloudflare Workers free tier (10ms CPU per req, 100K req/day)
- Use existing Telegram bot integration (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)
- Use existing React SPA + Hono Worker patterns (Zustand stores, `@/tree/` layer)
- Must not add npm dependencies beyond already installed (hono, vitest, zod, @cloudflare/workers-types)
- All metrics stored in existing D1 (AURA_DB) — no new bindings
- Bilingual VN+EN dashboard labels

### Touchpoints
| Action | File |
|--------|------|
| Create | `worker/src/lib/metrics-collector.ts` |
| Create | `worker/src/lib/alert-dispatcher.ts` |
| Create | `worker/src/routes/admin-metrics.ts` |
| Modify | `worker/src/middleware/logger.ts` (metrics hooks) |
| Modify | `worker/src/index.ts` (register route + cron digest) |
| Create | `src/pages/admin/metrics-dashboard.tsx` (dashboard page) |
| Create | `src/tree/metrics/use-metrics-store.ts` (Zustand store) |
| Create | `worker/src/__tests__/lib/metrics-collector.test.ts` |
| Create | `worker/src/__tests__/routes/admin-metrics.test.ts` |
| Create | `worker/migrations/002_metrics_tables.sql` |

---

## Approach A: Middleware Hooks + D1 Time-Series (Recommended)

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Worker Request                      │
│  logger.ts ──> metrics-collector.ts (increment)      │
│                  │                                   │
│                  ▼ (async, non-blocking)              │
│            ┌─────────────┐                           │
│            │ D1 metrics   │  ◄── time-series rows     │
│            │ _metrics     │                           │
│            │ _alerts      │                           │
│            └──────┬──────┘                           │
│                   │                                   │
│  ┌────────────────▼────────────────────┐             │
│  │ alert-dispatcher.ts                 │             │
│  │  - check thresholds                 │             │
│  │  - rate-limit (5min cooldown)       │             │
│  │  - format Telegram message          │             │
│  │  - dispatch via fetch(TELEGRAM_API) │             │
│  └────────────────────────────────────┘             │
│                                                       │
│  Cron (scheduled handler):                            │
│  - sendDailyDigest() → Telegram                       │
│  - pruneOldMetrics() → DELETE rows >30d               │
│  - detectAnomalies() → security alerts                │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                   React SPA                           │
│  /admin/metrics                                       │
│  ├── MetricsDashboard (page)                          │
│  ├── useMetricsStore (Zustand)                        │
│  └── fetches /api/admin/metrics?range=7d              │
│      └── { orders, revenue, errors, latency, users }  │
└─────────────────────────────────────────────────────┘
```

### Data Model

```sql
-- Time-series metrics (lightweight, 1 row per event)
CREATE TABLE IF NOT EXISTS _metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,          -- e.g. 'order_created', 'payment_success', 'error_5xx'
  value REAL NOT NULL DEFAULT 1,
  tags TEXT DEFAULT '{}',      -- JSON: {route, method, status}
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_metrics_name_created ON _metrics(name, created_at);

-- Alert log (dedup + cooldown tracking)
CREATE TABLE IF NOT EXISTS _alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_key TEXT NOT NULL,     -- e.g. 'error_rate_high', 'order_stuck'
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',  -- info|warning|critical
  dispatched INTEGER NOT NULL DEFAULT 0,    -- 0=pending, 1=sent
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_alerts_key_created ON _alerts(alert_key, created_at);
```

### Alert Rules

| Alert | Trigger | Cooldown | Severity |
|-------|---------|----------|----------|
| Order stuck | Order status unchanged >15min | 30min | warning |
| Payment failure | PayOS webhook returns error 3x in 10min | 15min | critical |
| Error rate spike | 5xx errors >5% of requests in 5min window | 10min | critical |
| D1 latency | Query >500ms any query | 30min | warning |
| KV failure | AUTH_KV.get returns null/error 3x in 5min | 15min | warning |
| Login brute force | Failed logins >10 from same IP in 1min | 5min | critical |
| Order anomaly | Order count >3x hourly avg | 30min | info |
| Worker CPU | Request CPU time >30ms | 1h | warning |

### Dashboard API Shape

```typescript
// GET /api/admin/metrics?range=24h|7d|30d
interface MetricsResponse {
  range: string;
  orders: { total: number; trend: Array<{ ts: string; count: number }> };
  revenue: { total: number; trend: Array<{ ts: string; amount: number }> };
  errors: { total: number; rate: number; byType: Record<string, number> };
  latency: { p50: number; p95: number; p99: number };
  customers: { new: number; active: number };
  topItems: Array<{ name: string; qty: number }>;
  systemHealth: { d1: 'ok' | 'degraded'; kv: 'ok' | 'degraded'; worker: 'ok' | 'degraded' };
}
```

### Daily Digest Format (Telegram)

```
📊 AURA CAFE — Daily Report (01/07/2026)

🛒 Orders: 47 (+12% vs yesterday)
💰 Revenue: 4,230,000 VND
👥 New customers: 8
⭐ Top item: Cà Phê Sữa Đá (x23)

⚠️ Errors: 3 (0.4%)
🔴 Alerts triggered: 1 (payment_retry)

🏥 System: D1 ✅ | KV ✅ | Worker ✅
---
AURA CAFE Monitoring • 21:00 ICT
```

### Pros
- Zero external dependencies — pure Worker + D1 + Telegram
- Fits free tier — metrics writes are async (waitUntil), don't block response
- Reuses existing patterns (logger, Telegram notify, Hono routes, Zustand stores)
- Lightweight: ~300 lines new code, 2 DB tables
- Dashboard stays within existing admin SPA (no new deploy target)

### Cons
- D1 is not optimized for time-series (no downsampling, no TTL)
- No distributed tracing (can't trace a request across middleware stack)
- No anomaly detection ML — simple threshold-based only
- Dashboard is basic (tables + simple charts, no Grafana-level viz)

---

## Approach B: Cloudflare Analytics Engine (Alternative)

Use Cloudflare's built-in Analytics Engine binding instead of D1. Requires `analytics_engine` binding in wrangler.toml.

### Pros
- Purpose-built for metrics (sampling, TTL, aggregation built-in)
- Near-zero latency (writes complete in microseconds)
- No D1 storage cost

### Cons
- Requires new Worker binding (adds complexity to wrangler.toml)
- Analytics Engine has limited query capability (can't do complex aggregations)
- Requires separate dashboard (CF Dashboard or Grafana, not custom UI)
- Vendor lock-in (CF-specific API, not portable)
- **REJECTED:** Adds binding complexity for marginal gain over D1 for this scale.

---

## Approach C: External Push Model (Rejected)

Push metrics to external service (PostHog, Grafana Cloud HTTP endpoint, custom webhook receiver).

### Pros
- Rich dashboards out of the box
- Alerting built-in

### Cons
- Requires external SaaS account (violates "zero cost" constraint)
- Adds network dependency (metrics lost if external service down)
- Privacy concern (order/revenue data leaves Cloudflare)
- **REJECTED:** Violates zero-cost constraint and no-external-deps principle.

---

## Recommendation: Approach A — Middleware Hooks + D1 Time-Series

**Why:**
1. Zero new dependencies — everything already in the stack
2. Fits free tier — async metrics writes don't impact response latency
3. Follows existing patterns — logger middleware, Telegram notify, Hono routes
4. Dashboard stays in existing admin SPA — no new deploy target
5. KISS — simple threshold alerts, simple SQL aggregations, simple frontend

## Implementation Considerations

### Performance
- Metrics writes go through `ctx.waitUntil()` — non-blocking, don't increase response time
- D1 metrics table uses indexes on `(name, created_at)` for fast aggregation queries
- Alert checks happen in cron (every 5 min), NOT in request hot path
- Metrics rows auto-pruned after 30 days (cron task)

### Reliability
- Alert dispatcher has 5-30min cooldown per alert type to prevent spam
- Failed alert dispatch retries once, then logs error
- If D1 write fails, metrics are silently dropped (don't fail the request)
- Dashboard falls back to empty state if metrics query fails

### Security
- `/api/admin/metrics` behind `requireAuth(['owner', 'staff'])`
- Telegram alerts sent to hardcoded TELEGRAM_CHAT_ID (not user-configurable)
- No PII in metrics (customer names, phones not stored in _metrics table)

## Success Metrics
- 100% of revenue-critical events trigger Telegram alert within 5 minutes
- Dashboard loads in <2 seconds for 30-day range
- Metrics collection adds <1ms to request latency (via waitUntil)
- Zero alert spam (no duplicate alerts within cooldown window)
- Daily digest arrives consistently at 21:00 ICT (±5 min)

## Risks
- D1 metrics table growth: mitigated by 30-day auto-prune cron
- Alert fatigue if thresholds too sensitive: mitigatable by cooldown windows, tuning in prod
- Worker CPU budget for aggregation queries: keep date ranges reasonable (max 30d)

## Unresolved Questions
- None. All 5 requirement categories locked.

## Next Step
Proceed to `/ck:plan --tdd` for the Observability + Alerting plan (first of 4 operational hardening plans).
