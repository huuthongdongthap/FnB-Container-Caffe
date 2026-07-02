---
title: "Phase 02 — Health Endpoint"
description: "Create proper /api/health route with uptime tracking and optional D1 connectivity check"
status: pending
priority: P2
effort: 1h
phase: 02
depends_on: []
blocks: [03]
---

## Overview

Replace the inlined `/api/health` handler in `worker/src/index.ts:233` with a proper route module at `worker/src/routes/health.ts`. The new endpoint tracks worker uptime and optionally checks D1 connectivity.

## Current State

**File:** `worker/src/index.ts:233`
```typescript
// ── Health check ──
app.get('/api/health', (c) => c.json({ status: 'ok', ts: new Date().toISOString() }));
```

This is minimal — no uptime, no D1 check, no route module separation.

## Target State

```json
// GET /api/health
{ "status": "ok", "timestamp": "2026-07-02T01:49:00.000Z", "uptime": 12345.678 }

// GET /api/health?db=1
{ "status": "ok", "timestamp": "2026-07-02T01:49:00.000Z", "uptime": 12345.678, "d1": "connected" }
```

## Requirements

- Return `{ status: "ok", timestamp, uptime }` — `uptime` in milliseconds since worker cold-start
- Optional D1 connectivity: `?db=1` query param triggers `SELECT 1` on AURA_DB, returns `d1: "connected"` or `d1: "error"` with `error` field
- Module structure: `worker/src/routes/health.ts` — follows existing pattern (`version.ts` is a route module, health should match)
- Test file: `worker/src/__tests__/routes/health.test.ts`

## Implementation Steps

### Step 1: Create `worker/src/routes/health.ts`

```typescript
/**
 * Health Route — /api/health
 * Returns worker status, uptime, and optional D1 connectivity check.
 */
import type { Env } from '../types/env';

// Capture cold-start time once at module load (top-level)
const START_TIME = Date.now();

export interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number; // milliseconds since cold-start
  d1?: 'connected' | 'error';
  error?: string;
}

export async function getHealth(env: Env, checkDb = false): Promise<HealthResponse> {
  const response: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Date.now() - START_TIME,
  };

  if (checkDb) {
    try {
      await env.AURA_DB.prepare('SELECT 1').first();
      response.d1 = 'connected';
    } catch (err) {
      response.d1 = 'error';
      response.error = (err as Error).message;
      response.status = 'degraded';
    }
  }

  return response;
}
```

### Step 2: Update `worker/src/index.ts`

Replace the inlined health handler (line 233) with:

```typescript
// ── Health check ──
import { getHealth } from './routes/health';
app.get('/api/health', async (c) => {
  const checkDb = c.req.query('db') === '1';
  const result = await getHealth(c.env, checkDb);
  const statusCode = result.status === 'degraded' ? 503 : 200;
  return c.json(result, statusCode as 200 | 503);
});
```

### Step 3: Create `worker/src/__tests__/routes/health.test.ts`

Test cases:
1. `getHealth` returns status "ok" with timestamp and uptime
2. `uptime` is a positive number
3. When `checkDb=true` and D1 mock returns row, `d1: "connected"`
4. When `checkDb=true` and D1 throws, `d1: "error"`, `status: "degraded"`
5. Optional: integration test with `app.request('/api/health')` for 200
6. Optional: integration test with `app.request('/api/health?db=1')` with mocked D1

Use `worker/src/__tests__/test-utils.ts` for common test setup if it provides Hono app helpers. Otherwise create minimal mock env with `{ AURA_DB: { prepare: fn } }`.

### Step 4: Verify

```bash
cd /Users/macbook/FnB-Container-Caffe
npm test 2>&1 | tail -5  # must show 775+ tests (770 + ~5 new)
```

## Dependency Note

Phase 02 is independent of Phase 01 — can run in parallel. However, the health endpoint IS required for Phase 03 (post-deploy verification calls `/api/health`).

## Test Matrix

| Scenario | Expected |
|----------|----------|
| `GET /api/health` | 200, `{ status: "ok", timestamp, uptime }` |
| `GET /api/health?db=1` (D1 healthy) | 200, `{ status: "ok", d1: "connected" }` |
| `GET /api/health?db=1` (D1 down) | 503, `{ status: "degraded", d1: "error", error: "..." }` |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| `START_TIME` resets between requests (module reload) | Low | Low | Documented behavior — Cloudflare isolates per-request by default but module-level state persists within same isolate |
| D1 check adds latency to health endpoint | Low | Low | Only when `?db=1` is passed; default health check is fast |
| Existing health check consumers break | Low | Medium | Field `ts` renamed to `timestamp`; check for callers first |

## Caller Check

Searching for `/api/health` consumers in the codebase (excluding `index.ts`): none found. The `ts` -> `timestamp` rename is safe.

## Related Files

- `worker/src/routes/health.ts` — **create**
- `worker/src/index.ts:233` — modify
- `worker/src/__tests__/routes/health.test.ts` — **create**
- `worker/src/routes/version.ts` — reference pattern (no changes)
