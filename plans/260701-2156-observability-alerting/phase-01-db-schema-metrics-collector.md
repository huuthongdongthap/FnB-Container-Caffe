---
phase: 1
title: "DB Schema + Metrics Collector"
status: pending
priority: P1
dependencies: []
effort: 3-4h
---

# Phase 1: DB Schema + Metrics Collector

## Overview

Create D1 migration for `_metrics` and `_alerts` tables. Build `metrics-collector.ts` library — a lightweight, non-blocking metrics recorder. Hook into existing `logger.ts` middleware to auto-capture request metrics. Zero impact on response latency (all writes via `ctx.waitUntil`).

## TDD Structure

```
Step 1-T: Write tests for metrics collector (unit)
Step 1: Create D1 migration
Step 2: Build metrics-collector.ts
Step 3: Hook into logger.ts middleware (request metrics)
Step 4: Hook into business routes (order, payment, auth metrics)
Step 5: Verify metrics land in D1
```

## Requirements

- Functional: `_metrics` table stores name, value, tags, created_at
- Functional: `_alerts` table stores alert_key, message, severity, dispatched flag
- Functional: `recordMetric(name, value, tags)` writes to D1 via `waitUntil`
- Functional: `recordAlert(key, message, severity)` deduplicates within cooldown
- Functional: `pruneOldMetrics(days)` cron for cleanup
- Functional: logger.ts calls `recordMetric` for every request (method, path, status, duration)
- Functional: **Business metrics emitted from existing routes:**
  - `order_created` — emitted when order is placed (value=order_amount)
  - `payment_success` — emitted on payment webhook success (value=amount)
  - `payment_failed` — emitted on payment failure (value=amount)
  - `revenue` — emitted on confirmed payment (value=amount)
  - `login_failed` — emitted on failed auth attempt
  - `order_stuck` — emitted by cron when order pending >10 min
- Non-functional: Metrics write must NOT block response (<1ms overhead in hot path)
- Non-functional: Indexes on `(name, created_at)` for fast aggregation queries

## Architecture

```
recordMetric('order_created', 1, { payment_method: 'payos' })
  └── ctx.waitUntil(
        db.prepare('INSERT INTO _metrics ...').bind(...).run()
      )

logger.ts (existing) — patched:
  const start = Date.now()
  await next()
  const duration = Date.now() - start
  ctx.waitUntil(recordMetric('request', 1, {
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration,
  }))
```

## Related Code Files

| Action | File |
|--------|------|
| Create | `worker/migrations/002_metrics_tables.sql` |
| Create | `worker/src/lib/metrics-collector.ts` |
| Modify | `worker/src/middleware/logger.ts` (add request metrics hook) |
| Modify | `worker/src/routes/orders.ts` (emit `order_created` metric) |
| Modify | `worker/src/routes/webhooks.ts` (emit `payment_success`, `payment_failed`, `revenue`) |
| Modify | `worker/src/routes/auth.ts` (emit `login_failed` metric) |
| Modify | `worker/src/routes/cron.ts` (emit `order_stuck` metric) |
| Create | `worker/src/__tests__/lib/metrics-collector.test.ts` |

## Implementation Steps

### Step 1-T: Write tests first (TDD)

```typescript
// worker/src/__tests__/lib/metrics-collector.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMetricsCollector } from '../../lib/metrics-collector';

describe('metrics-collector', () => {
  it('recordMetric returns without throwing when DB is available');
  it('recordMetric silently drops when DB is null (no crash)');
  it('recordAlert deduplicates within cooldown window');
  it('recordAlert dispatches when cooldown expired');
  it('pruneOldMetrics calls DELETE for rows older than N days');
  it('recordMetric serializes tags as JSON string');
});
```

### Step 1: Create D1 migration

File: `worker/migrations/002_metrics_tables.sql`

```sql
-- Metrics time-series table
CREATE TABLE IF NOT EXISTS _metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  value REAL NOT NULL DEFAULT 1,
  tags TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_metrics_name_created ON _metrics(name, created_at);

-- Alert dedup + cooldown tracking
CREATE TABLE IF NOT EXISTS _alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_key TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  dispatched INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_alerts_key_created ON _alerts(alert_key, created_at);
```

### Step 2: Build metrics-collector.ts

File: `worker/src/lib/metrics-collector.ts`

```typescript
import type { D1Database } from '@cloudflare/workers-types';

interface MetricTags { [key: string]: string | number | boolean; }
interface AlertOptions { severity?: 'info' | 'warning' | 'critical'; cooldownMinutes?: number; }

export function createMetricsCollector(db: D1Database | null) {
  async function recordMetric(name: string, value: number = 1, tags: MetricTags = {}): Promise<void> {
    if (!db) return;
    try {
      await db.prepare(
        'INSERT INTO _metrics (name, value, tags, created_at) VALUES (?, ?, ?, ?)'
      ).bind(name, value, JSON.stringify(tags), new Date().toISOString()).run();
    } catch { /* silently drop — metrics must never crash the request */ }
  }

  async function recordAlert(key: string, message: string, opts: AlertOptions = {}): Promise<boolean> {
    if (!db) return false;
    const { severity = 'warning', cooldownMinutes = 30 } = opts;
    const cutoff = new Date(Date.now() - cooldownMinutes * 60 * 1000).toISOString();

    // Check cooldown — skip if same alert fired recently
    const recent = await db.prepare(
      "SELECT id FROM _alerts WHERE alert_key = ? AND created_at > ? AND dispatched = 1"
    ).bind(key, cutoff).first();
    if (recent) return false; // still in cooldown

    await db.prepare(
      'INSERT INTO _alerts (alert_key, message, severity, dispatched, created_at) VALUES (?, ?, ?, 0, ?)'
    ).bind(key, message, severity, new Date().toISOString()).run();
    return true; // alert queued for dispatch
  }

  async function pruneOldMetrics(daysRetention: number = 30): Promise<number> {
    if (!db) return 0;
    const cutoff = new Date(Date.now() - daysRetention * 86400000).toISOString();
    const result = await db.prepare(
      'DELETE FROM _metrics WHERE created_at < ?'
    ).bind(cutoff).run();
    return (result as any).changes || 0;
  }

  return { recordMetric, recordAlert, pruneOldMetrics };
}
```

### Step 3: Hook into logger.ts

Patch `worker/src/middleware/logger.ts`:
- Import `createMetricsCollector`
- After logging each request, call `ctx.waitUntil(metrics.recordMetric(...))`
- Capture: method, path, status code, response time in ms

```typescript
// Add to the request-logging middleware:
import { createMetricsCollector } from '../lib/metrics-collector';

// Inside the middleware, after next():
const duration = Date.now() - startTime;
if (c.executionCtx) {
  const metrics = createMetricsCollector(c.env.AURA_DB);
  c.executionCtx.waitUntil(metrics.recordMetric('request', 1, {
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration,
  }));
}
```

### Step 4: Hook into business routes

**orders.ts** — After order creation succeeds:
```typescript
// Inside the order creation handler, after successful insert:
const metrics = createMetricsCollector(c.env.AURA_DB);
c.executionCtx?.waitUntil(metrics.recordMetric('order_created', order.total, {
  payment_method: order.payment_method,
  customer_id: order.customer_id,
}));
```

**webhooks.ts** — After payment webhook processing:
```typescript
// On payment success:
const metrics = createMetricsCollector(c.env.AURA_DB);
c.executionCtx?.waitUntil(metrics.recordMetric('payment_success', amount, {
  provider: body.provider,
  order_id: body.order_id,
}));
c.executionCtx?.waitUntil(metrics.recordMetric('revenue', amount, {
  provider: body.provider,
}));

// On payment failure:
c.executionCtx?.waitUntil(metrics.recordMetric('payment_failed', amount, {
  provider: body.provider,
  order_id: body.order_id,
  reason: body.reason || 'unknown',
}));
```

**auth.ts** — After failed login attempt:
```typescript
// Inside the auth failure path:
const metrics = createMetricsCollector(c.env.AURA_DB);
c.executionCtx?.waitUntil(metrics.recordMetric('login_failed', 1, {
  ip: c.req.header('CF-Connecting-IP') || 'unknown',
  email: body.email,
}));
```

**cron.ts** — Order stuck detection (add to existing cron handlers):
```typescript
// In a cron handler that checks for stuck orders:
const result = await db.prepare(
  "SELECT COUNT(*) as c FROM orders WHERE status = 'pending' AND created_at < datetime('now', '-10 minutes')"
).first();
const stuckCount = (result as any)?.c ?? 0;
if (stuckCount > 0) {
  c.executionCtx?.waitUntil(metrics.recordMetric('order_stuck', stuckCount));
}
```

### Step 5: Verify metrics land in D1

```bash
# After deploying, query D1 to confirm metrics are being recorded
npx wrangler d1 execute AURA_DB --command "SELECT name, COUNT(*) as cnt FROM _metrics GROUP BY name ORDER BY cnt DESC LIMIT 10"
```

## Success Criteria

- [ ] Migration applies without errors (`_metrics` + `_alerts` tables exist)
- [ ] `recordMetric()` writes row to `_metrics` with correct name/value/tags
- [ ] `recordAlert()` deduplicates — second call within cooldown returns `false`
- [ ] `pruneOldMetrics(30)` deletes rows older than 30 days
- [ ] logger.ts middleware captures method, path, status, duration for every request
- [ ] orders.ts emits `order_created` with correct total and payment_method tag
- [ ] webhooks.ts emits `payment_success`, `payment_failed`, `revenue` with correct amounts
- [ ] auth.ts emits `login_failed` on failed authentication
- [ ] cron.ts emits `order_stuck` when pending orders exceed 10-min threshold
- [ ] Metrics write failure does NOT crash the request (silent drop)
- [ ] All `metrics-collector.test.ts` tests pass
- [ ] All existing 102 tests still pass (no logger regression)

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| D1 write adds latency | `ctx.waitUntil()` — async, non-blocking |
| Metrics table grows unbounded | `pruneOldMetrics` cron (30-day retention) |
| DB null in local dev | `if (!db) return` guard at top of every function |
