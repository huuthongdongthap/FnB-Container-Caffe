---
phase: 2
title: "Metrics API + Alert Dispatcher"
status: pending
priority: P1
dependencies: [1]
effort: 2-3h
---

# Phase 2: Metrics API + Alert Dispatcher

## Overview

Build `GET /api/admin/metrics` endpoint for querying D1 time-series data. Build `alert-dispatcher.ts` with threshold checks for revenue, infrastructure, and security events. Wire dispatch to Telegram bot. Add cron trigger for periodic dispatch + daily digest.

## TDD Structure

```
Step 2-T: Write tests for alert-dispatcher (unit) + metrics endpoint (integration)
Step 5: Build GET /api/admin/metrics?range=24h|7d|30d
Step 6: Build alert-dispatcher.ts (threshold checks + cooldown)
Step 7: Telegram dispatch + format message
Step 8: Register cron trigger in index.ts
Step 9: Wire alert dispatch to metrics-collector alert queue
```

## Requirements

- Functional: `GET /api/admin/metrics?range=24h|7d|30d` returns aggregated metrics JSON
- Functional: `GET /api/admin/metrics` requires staff auth (same guard as existing admin routes)
- Functional: `dispatchAlerts()` checks thresholds: order-stuck-10min, payment-failure-rate, 5xx-spike, d1-latency-high, failed-login-spike
- Functional: `dispatchDigest()` sends daily summary at 21:00 ICT (orders, revenue, errors, top paths)
- Functional: Alerts dispatched via Telegram bot (existing `@AuraCafe_Bot` or equivalent)
- Functional: Cooldown per alert_key prevents duplicate alerts (5min for critical, 30min for warnings)
- Non-functional: Metrics queries use indexed columns (`name`, `created_at`) for fast aggregation
- Non-functional: Alert dispatch runs in cron context (not request path) — no latency impact

## Architecture

```
Cron (every 5 min):
  dispatchAlerts(db, telegramClient)
    ├── query D1 _metrics for last 5 min
    ├── check thresholds for each alert type
    ├── dedup via _alerts table cooldown
    └── send to Telegram if triggered

Cron (daily at 21:00 ICT = 14:00 UTC):
  dispatchDigest(db, telegramClient)
    ├── query D1 _metrics for last 24h
    ├── compute: order count, revenue sum, error rate, top 5 paths
    └── send formatted Telegram message

API:
  GET /api/admin/metrics?range=7d
    ├── auth guard (staff only)
    ├── aggregate _metrics by range bucket (hour/day)
    └── return { orders, revenue, requests, errors, latency_p50, latency_p95 }
```

## Related Code Files

| Action | File |
|--------|------|
| Create | `worker/src/lib/alert-dispatcher.ts` |
| Create | `worker/src/routes/admin-metrics.ts` |
| Modify | `worker/src/index.ts` (add route + cron triggers) |
| Modify | `worker/src/lib/telegram-bot.ts` (add `sendAlert` method) |
| Modify | `worker/wrangler.toml` (add `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALERT_CHAT_ID` vars) |
| Create | `worker/src/__tests__/lib/alert-dispatcher.test.ts` |
| Create | `worker/src/__tests__/routes/admin-metrics.test.ts` |

### New Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token for alert dispatch (reuse existing if available) |
| `TELEGRAM_ALERT_CHAT_ID` | Yes | Chat/group ID for alert delivery |
| `CRON_SECRET` | Yes | Shared secret for cron trigger auth (reuse existing if available) |

## Implementation Steps

### Step 2-T: Write tests first (TDD)

```typescript
// worker/src/__tests__/lib/alert-dispatcher.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createAlertDispatcher } from '../../lib/alert-dispatcher';

describe('alert-dispatcher', () => {
  it('dispatchAlerts returns empty when no thresholds breached');
  it('dispatchAlerts fires alert when 5xx errors exceed 5/min');
  it('dispatchAlerts fires alert when payment failure rate exceeds 10%');
  it('dispatchAlerts respects cooldown — skips if alert_key fired <5min ago');
  it('dispatchAlerts fires alert for D1 latency >500ms on any query');
  it('dispatchAlerts fires alert for failed login >10 within 1 min');
  it('dispatchDigest computes order count, revenue, errors, top paths');
  it('dispatchDigest formats Telegram message with emoji sections');
  it('sendTelegramAlert calls Telegram API with markdown-formatted text');
});

// worker/src/__tests__/routes/admin-metrics.test.ts
describe('GET /api/admin/metrics', () => {
  it('returns 401 when not authenticated as staff');
  it('returns 200 with metrics for range=24h');
  it('returns 200 with metrics for range=7d');
  it('returns 200 with metrics for range=30d');
  it('returns 400 for invalid range value');
  it('aggregates request count, error rate, latency p50/p95');
});
```

### Step 5: Build GET /api/admin/metrics

File: `worker/src/routes/admin-metrics.ts`

```typescript
import { Hono } from 'hono';
import type { Env } from '../types/env';

const adminMetrics = new Hono<{ Bindings: Env }>();

adminMetrics.get('/', async (c) => {
  // Auth guard — reuse existing staff check
  const staff = c.get('staff');
  if (!staff) return c.json({ error: 'Unauthorized' }, 401);

  const range = c.req.query('range') || '24h';
  const validRanges = ['24h', '7d', '30d'];
  if (!validRanges.includes(range)) {
    return c.json({ error: 'Invalid range. Use: 24h, 7d, 30d' }, 400);
  }

  const hours = range === '24h' ? 24 : range === '7d' ? 168 : 720;
  const bucketMinutes = range === '24h' ? 60 : 360; // hourly for 24h, 6h for 7d/30d

  const db = c.env.AURA_DB;
  const since = new Date(Date.now() - hours * 3600000).toISOString();

  const metrics = {
    range,
    since,
    generated_at: new Date().toISOString(),
    requests: await getRequestMetrics(db, since),
    errors: await getErrorMetrics(db, since),
    orders: await getOrderMetrics(db, since),
    revenue: await getRevenueMetrics(db, since),
    latency: await getLatencyMetrics(db, since),
    topPaths: await getTopPaths(db, since),
  };

  return c.json(metrics);
});

async function getRequestMetrics(db: any, since: string) {
  const row = await db.prepare(
    "SELECT COUNT(*) as total, AVG(value) as avg_duration FROM _metrics WHERE name = 'request' AND created_at >= ?"
  ).bind(since).first();
  return { total: (row as any)?.total || 0 };
}

async function getErrorMetrics(db: any, since: string) {
  const row = await db.prepare(
    "SELECT COUNT(*) as total FROM _metrics WHERE name = 'request' AND json_extract(tags, '$.status') >= 400 AND created_at >= ?"
  ).bind(since).first();
  return { total: (row as any)?.total || 0 };
}

async function getOrderMetrics(db: any, since: string) {
  const row = await db.prepare(
    "SELECT COUNT(*) as total FROM _metrics WHERE name = 'order_created' AND created_at >= ?"
  ).bind(since).first();
  return { total: (row as any)?.total || 0 };
}

async function getRevenueMetrics(db: any, since: string) {
  const row = await db.prepare(
    "SELECT COALESCE(SUM(value), 0) as total FROM _metrics WHERE name = 'revenue' AND created_at >= ?"
  ).bind(since).first();
  return { total: (row as any)?.total || 0 };
}

async function getLatencyMetrics(db: any, since: string) {
  // Subquery for ordered latency values to compute p50/p95
  const rows = await db.prepare(
    "SELECT CAST(json_extract(tags, '$.duration') AS REAL) as duration FROM _metrics WHERE name = 'request' AND created_at >= ? AND json_extract(tags, '$.duration') IS NOT NULL ORDER BY duration"
  ).bind(since).all();
  const durations = (rows.results || []).map((r: any) => r.duration).sort((a: number, b: number) => a - b);
  if (!durations.length) return { p50: 0, p95: 0 };
  return {
    p50: durations[Math.floor(durations.length * 0.5)],
    p95: durations[Math.floor(durations.length * 0.95)],
  };
}

async function getTopPaths(db: any, since: string) {
  const rows = await db.prepare(
    "SELECT json_extract(tags, '$.path') as path, COUNT(*) as cnt FROM _metrics WHERE name = 'request' AND created_at >= ? GROUP BY path ORDER BY cnt DESC LIMIT 10"
  ).bind(since).all();
  return (rows.results || []).map((r: any) => ({ path: r.path || 'unknown', count: r.cnt }));
}

export default adminMetrics;
```

### Step 6: Build alert-dispatcher.ts

File: `worker/src/lib/alert-dispatcher.ts`

```typescript
import type { D1Database } from '@cloudflare/workers-types';
import { createMetricsCollector } from './metrics-collector';

interface AlertConfig {
  key: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  cooldownMinutes: number;
  threshold: number;
  query: string; // SQL that returns a single row with `value` column
}

const ALERT_DEFINITIONS: AlertConfig[] = [
  {
    key: 'revenue:5xx_spike',
    description: '🚨 5xx errors exceed threshold (5/min)',
    severity: 'critical',
    cooldownMinutes: 5,
    threshold: 5,
    query: "SELECT COUNT(*) as value FROM _metrics WHERE name = 'request' AND CAST(json_extract(tags, '$.status') AS INTEGER) >= 500 AND created_at >= datetime('now', '-5 minutes')",
  },
  {
    key: 'revenue:payment_failure_rate',
    description: '⚠️ Payment failure rate exceeds 10%',
    severity: 'critical',
    cooldownMinutes: 5,
    threshold: 10,
    query: `
      SELECT CASE WHEN total = 0 THEN 0 ELSE CAST(failed AS REAL) * 100.0 / total END as value FROM (
        SELECT
          (SELECT COUNT(*) FROM _metrics WHERE name = 'payment_failed' AND created_at >= datetime('now', '-30 minutes')) as failed,
          (SELECT COUNT(*) FROM _metrics WHERE name = 'payment_success' AND created_at >= datetime('now', '-30 minutes')) as total
      )
    `,
  },
  {
    key: 'infra:d1_latency_high',
    description: '🐢 D1 query latency exceeds 500ms',
    severity: 'warning',
    cooldownMinutes: 15,
    threshold: 500,
    query: "SELECT COALESCE(MAX(CAST(json_extract(tags, '$.duration') AS REAL)), 0) as value FROM _metrics WHERE name = 'request' AND created_at >= datetime('now', '-5 minutes')",
  },
  {
    key: 'security:failed_login_spike',
    description: '🔐 Failed login attempts exceed 10/min',
    severity: 'warning',
    cooldownMinutes: 10,
    threshold: 10,
    query: "SELECT COUNT(*) as value FROM _metrics WHERE name = 'login_failed' AND created_at >= datetime('now', '-1 minutes')",
  },
  {
    key: 'revenue:order_stuck',
    description: '📦 Orders stuck in pending >10 min',
    severity: 'critical',
    cooldownMinutes: 5,
    threshold: 1,
    query: "SELECT COUNT(*) as value FROM _metrics WHERE name = 'order_stuck' AND created_at >= datetime('now', '-10 minutes')",
  },
];

export function createAlertDispatcher(db: D1Database | null) {
  const metrics = createMetricsCollector(db);

  async function dispatchAlerts(sendTelegram: (msg: string, severity: string) => Promise<void>): Promise<string[]> {
    if (!db) return [];
    const fired: string[] = [];

    for (const alert of ALERT_DEFINITIONS) {
      try {
        const row = await db.prepare(alert.query).first();
        const value = (row as any)?.value ?? 0;

        if (value >= alert.threshold) {
          const queued = await metrics.recordAlert(
            alert.key,
            `${alert.description}\nValue: ${value} (threshold: ${alert.threshold})`,
            { severity: alert.severity, cooldownMinutes: alert.cooldownMinutes }
          );
          if (queued) {
            await sendTelegram(
              `${alert.description}\n📊 Current: ${value} / Threshold: ${alert.threshold}`,
              alert.severity
            );
            fired.push(alert.key);
          }
        }
      } catch {
        // Alert check failure must not crash the dispatcher
      }
    }

    return fired;
  }

  async function dispatchDigest(sendTelegram: (msg: string) => Promise<void>): Promise<void> {
    if (!db) return;

    const since = "datetime('now', '-24 hours')";

    const [orders, revenue, errors, totalReqs] = await Promise.all([
      db.prepare(`SELECT COUNT(*) as c FROM _metrics WHERE name = 'order_created' AND created_at >= ${since}`).first(),
      db.prepare(`SELECT COALESCE(SUM(value), 0) as s FROM _metrics WHERE name = 'revenue' AND created_at >= ${since}`).first(),
      db.prepare(`SELECT COUNT(*) as c FROM _metrics WHERE name = 'request' AND CAST(json_extract(tags, '$.status') AS INTEGER) >= 400 AND created_at >= ${since}`).first(),
      db.prepare(`SELECT COUNT(*) as c FROM _metrics WHERE name = 'request' AND created_at >= ${since}`).first(),
    ]);

    const msg = [
      '📊 *AURA CAFE Daily Digest*',
      `📅 ${new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`,
      '',
      `🛒 Orders: ${(orders as any)?.c || 0}`,
      `💰 Revenue: ${new Intl.NumberFormat('vi-VN').format((revenue as any)?.s || 0)} VND`,
      `✅ Success Rate: ${totalReqs ? ((1 - (errors as any)?.c / (totalReqs as any)?.c) * 100).toFixed(1) : '100'}%`,
      `❌ Errors: ${(errors as any)?.c || 0}`,
      '',
      '— AURA CAFE Observability',
    ].join('\n');

    await sendTelegram(msg);
  }

  return { dispatchAlerts, dispatchDigest };
}
```

### Step 7: Telegram dispatch wiring

Patch `worker/src/lib/telegram-bot.ts` (or create a `sendAlert` wrapper if telegram-bot doesn't exist):

```typescript
// If telegram-bot.ts already exports a sendMessage function, reuse it.
// Otherwise add a lightweight sendAlert wrapper:
export async function sendTelegramAlert(botToken: string, chatId: string, message: string): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown',
      disable_notification: false,
    }),
  });
}
```

### Step 8: Register cron trigger in index.ts

Add to `worker/src/index.ts`:

```typescript
import { createAlertDispatcher } from './lib/alert-dispatcher';
import { sendTelegramAlert } from './lib/telegram-bot';
import adminMetrics from './routes/admin-metrics';

// Register route
app.route('/api/admin/metrics', adminMetrics);

// Cron: alert dispatch every 5 minutes
app.get('/cron/alerts', async (c) => {
  const dispatcher = createAlertDispatcher(c.env.AURA_DB);
  const sendFn = async (msg: string, _severity: string) => {
    await sendTelegramAlert(c.env.TELEGRAM_BOT_TOKEN, c.env.TELEGRAM_ALERT_CHAT_ID, msg);
  };
  const fired = await dispatcher.dispatchAlerts(sendFn);
  return c.json({ fired, at: new Date().toISOString() });
});

// Cron: daily digest at 21:00 ICT (triggers every hour, checks time internally)
app.get('/cron/digest', async (c) => {
  const now = new Date();
  const ictHour = parseInt(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', hour12: false }));
  // Only dispatch near 21:00 ICT (allow 5 min window)
  if (ictHour !== 21) {
    return c.json({ skipped: true, reason: 'Not digest time', ictHour });
  }

  const dispatcher = createAlertDispatcher(c.env.AURA_DB);
  const sendFn = async (msg: string) => {
    await sendTelegramAlert(c.env.TELEGRAM_BOT_TOKEN, c.env.TELEGRAM_ALERT_CHAT_ID, msg);
  };
  await dispatcher.dispatchDigest(sendFn);
  return c.json({ ok: true, at: now.toISOString() });
});
```

### Step 9: Wire alert dispatch to metrics-collector

No additional wiring needed — Phase 1's `recordAlert()` already writes to `_alerts` table. The `dispatchAlerts()` function in step 6 queries `_metrics` directly and uses `recordAlert()` for cooldown tracking. This step is verification only:

```bash
# After deploy, trigger alert check manually:
curl https://auraspace.cafe/cron/alerts
# Check Telegram for any fired alerts
```

## Success Criteria

- [ ] `GET /api/admin/metrics?range=24h` returns 200 with correct aggregation
- [ ] `GET /api/admin/metrics?range=7d` returns 200 with 6h buckets
- [ ] `GET /api/admin/metrics?range=30d` returns 200 with 6h buckets
- [ ] `GET /api/admin/metrics` returns 401 without staff auth
- [ ] `GET /api/admin/metrics?range=invalid` returns 400
- [ ] `dispatchAlerts()` fires Telegram message when 5xx >5 in 5 min
- [ ] `dispatchAlerts()` does NOT fire duplicate alert within cooldown
- [ ] `dispatchDigest()` sends formatted daily summary to Telegram at 21:00 ICT
- [ ] All alert-dispatcher + admin-metrics tests pass
- [ ] All existing 102 tests still pass (no regression)

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Alert spam from flapping thresholds | Cooldown per alert_key (5-30min) |
| D1 queries in cron path timeout | Each query is simple COUNT/MAX with index |
| Telegram API down | Dispatch failure logged via metrics-collector; no retry storm |
| Digest fires multiple times | Hour check with exact 21:00 ICT window |
