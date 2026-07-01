---
title: "Phase 1: Customer-facing Route Tests"
description: "Tests for 12 high-priority customer-facing routes: checkin, reservations, referrals, products, orders, orders-hono, categories, menu, promotions, birthday, reviews, loyalty"
status: completed
priority: P1
effort: 6h
phase: 1
depends_on: []
---

# Phase 1: Customer-facing Route Tests

## Overview

12 routes that customers interact with directly. These are the highest priority for test coverage because failures here are user-visible.

## Route-to-Test Mapping

| # | Route File | Test File | Handler Type | Complexity | Key Endpoints |
|---|-----------|-----------|--------------|------------|---------------|
| 1 | `worker/src/routes/checkin.ts` | `tests/checkin.test.ts` | Hono Router | Medium | POST /, PATCH /:id/approve, PATCH /:id/reject, GET / |
| 2 | `worker/src/routes/reservations.ts` | `tests/reservations.test.ts` | Hono Router | Medium | GET /availability, POST /, GET /, DELETE /:id |
| 3 | `worker/src/routes/referrals.ts` | `tests/referrals.test.ts` | Hono Router | High | GET /code, POST /apply, GET /stats |
| 4 | `worker/src/routes/products.ts` | `tests/products.test.ts` | Hono Router | Medium | GET /, GET /:id, POST /, PUT /:id, DELETE /:id |
| 5 | `worker/src/routes/orders.ts` | `tests/orders.test.ts` | Plain handlers | High | createOrder, getOrder, updateOrder, getAdminOrders, getStats |
| 6 | `worker/src/routes/orders-hono.ts` | `tests/orders-hono.test.ts` | Hono Router | Medium | GET /kds, PATCH /:id/status, POST /checkout, GET /, GET /:id |
| 7 | `worker/src/routes/categories.ts` | `tests/categories.test.ts` | Hono Router | Low | GET /, GET /:id, POST /, PUT /:id, DELETE /:id |
| 8 | `worker/src/routes/menu.ts` | `tests/menu.test.ts` | Plain handlers | Low | getMenu, getMenuItem |
| 9 | `worker/src/routes/promotions.ts` | `tests/promotions.test.ts` | Hono Router | Medium | POST /validate, POST /redeem |
| 10 | `worker/src/routes/birthday.ts` | `tests/birthday.test.ts` | Hono Router | Low | GET /check, POST /redeem |
| 11 | `worker/src/routes/reviews.ts` | `tests/reviews.test.ts` | Hono Router | Low | POST /, GET / |
| 12 | `worker/src/routes/loyalty.ts` | `tests/loyalty.test.ts` | Hono Router | Very High | ~15 endpoints (phone-auth, profile, earn, spend, redeem, campaigns, etc.) |

## Test Matrix Per Route

Each route file must have at minimum these test categories:

### For Hono Routers (routes 1-4, 6-7, 9-12)

```
describe('{Route Name}', () => {
  describe('GET /endpoint', () => {
    test('returns 200 with data')         // happy path
    test('returns 404 when not found')    // edge case
    test('returns empty array when no data') // edge case
  })
  describe('POST /endpoint', () => {
    test('creates resource and returns 201')  // happy path
    test('returns 400 on missing required fields')  // validation
    test('returns 400 on invalid field types')  // validation
    test('returns 409 on duplicate')       // conflict (if applicable)
  })
  describe('PUT/PATCH /endpoint/:id', () => {
    test('updates resource and returns 200')  // happy path
    test('returns 404 when not found')     // edge case
  })
  describe('DELETE /endpoint/:id', () => {
    test('deletes resource and returns 200')  // happy path
    test('returns 404 when not found')     // edge case
  })
})
```

### For Plain Handlers (routes 5, 8)

```
describe('{Handler Name}', () => {
  test('returns 200 with data')           // happy path
  test('returns 400 on invalid input')    // validation
  test('returns 404 when not found')      // edge case
  test('returns 500 on DB error')         // error case
})
```

## Concrete Test Example: checkin.test.ts

```typescript
/**
 * Checkin Route Tests — /api/checkin
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

// ── Mock D1 ─────────────────────────────────────────────────
function createMockD1(seedData: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = {
    checkins: [...(seedData.checkins || [])],
    customers: [...(seedData.customers || [])],
  };

  function getPrimaryTable(sql: string) {
    const fromMatch = sql.match(/\bFROM\s+(\w+)/i);
    return fromMatch ? fromMatch[1] : null;
  }

  const db = {
    prepare: vi.fn((q: string) => {
      const stmt: any = {
        _sql: q, _bindValues: [] as any[],
        bind: vi.fn(function (...vals: any[]) { this._bindValues.push(...vals); return this; }),
        first: vi.fn(async function (this: any) {
          const table = getPrimaryTable(q);
          const rows = (table && tables[table]) ? tables[table] : [];
          return rows[0] || null;
        }),
        all: vi.fn(async function (this: any) {
          const table = getPrimaryTable(q);
          const rows = (table && tables[table]) ? tables[table] : [];
          return { results: rows };
        }),
        run: vi.fn(async function (this: any) {
          // INSERT handling
          const insertMatch = q.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i);
          if (insertMatch) {
            const table = insertMatch[1];
            if (!tables[table]) tables[table] = [];
            const row: any = {};
            const cols = q.match(/\(([^)]+)\)/);
            if (cols) {
              cols[1].split(',').map(c => c.trim()).forEach((n, i) => {
                row[n] = this._bindValues[i];
              });
            }
            tables[table].push(row);
          }
          return { success: true };
        }),
      };
      return stmt;
    }),
  };
  return db;
}

function createMockEnv(overrides: Record<string, unknown> = {}) {
  return {
    AURA_DB: createMockD1(),
    JWT_SECRET: 'test-secret',
    ...overrides,
  };
}

let checkinRouter: any;
let env: ReturnType<typeof createMockEnv>;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  env = createMockEnv();
  const mod = await import('../worker/src/routes/checkin.ts');
  checkinRouter = mod.checkinRouter;
});

describe('POST /api/checkin', () => {
  test('creates a check-in and returns 201', async () => {
    env.AURA_DB = createMockD1({
      customers: [{ id: 'cust1', name: 'Nguyen Van A' }],
    });

    const res = await checkinRouter.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: 'cust1', customer_name: 'Nguyen Van A' }),
    }, env);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('pending');
    expect(body.data.reward_amount).toBe(5000);
  });

  test('returns 400 when customer_id is missing', async () => {
    const res = await checkinRouter.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('returns 400 on duplicate check-in same day', async () => {
    const todayISO = new Date().toISOString().slice(0, 10);
    env.AURA_DB = createMockD1({
      customers: [{ id: 'cust1', name: 'A' }],
      checkins: [{ id: 'ci_existing', customer_id: 'cust1', checkin_date: todayISO, status: 'pending' }],
    });

    const res = await checkinRouter.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: 'cust1' }),
    }, env);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Already checked in/);
  });
});

describe('PATCH /:id/approve', () => {
  test('approves check-in and adds cashback', async () => {
    // Skip auth middleware — test the handler directly by mocking requireAuth
    // Or test with a modified router without middleware
  });

  test('returns 404 for non-existent check-in', async () => { /* ... */ });
});

describe('GET /', () => {
  test('returns list of check-ins', async () => {
    const res = await checkinRouter.request('/', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});
```

## Auth Middleware Note

Routes with `requireAuth` middleware (reservations PATCH/DELETE, orders-hono PATCH, loyalty routes) need special handling in tests. Two strategies:

**Strategy A — Test router directly with pre-set auth context:**
```typescript
// Mount router without middleware by importing and testing sub-router
// Most Hono routers use requireAuth only on specific routes — test the unauthenticated routes first
```

**Strategy B — Mock requireAuth middleware:**
```typescript
vi.mock('../worker/src/middleware/auth', () => ({
  requireAuth: () => async (c: any, next: any) => { await next(); },
}));
```

Use Strategy B for routes that are entirely auth-gated (loyalty, referrals). Use Strategy A for routes with mixed auth (checkin, reservations, shifts).

## Complexity Notes

- **loyalty.ts** (640 lines, ~15 endpoints) — the most complex route file. Tests should focus on public endpoints (phone-auth, tiers, active-campaign, lookup) and key auth endpoints (profile, balance, earn-points, spend-cashback)
- **orders.ts** (548 lines) — plain handlers with ERPNext triggers and Telegram notifications. Mock fetch for external calls.
- **referrals.ts** (320 lines) — auth-gated via `requireCustomer` middleware. Use Strategy B (mock middleware).

## Success Criteria

- [x] 12 test files created in `tests/`
- [x] Minimum 3 tests per route file
- [x] All existing 770 tests pass
- [x] `npx tsc --noEmit` passes for worker
