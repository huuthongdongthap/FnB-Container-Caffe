---
title: "Phase 3: Admin Route Tests"
description: "Tests for 4 admin routes: admin-loyalty, admin-metrics, auth, customers"
status: completed
priority: P3
effort: 2h
phase: 3
depends_on: [phase-01]
---

# Phase 3: Admin Route Tests

## Overview

4 routes serving admin dashboards, auth, and customer management. Lower priority than customer-facing routes but critical for staff operations.

## Route-to-Test Mapping

| # | Route File | Test File | Handler Type | Key Endpoints |
|---|-----------|-----------|--------------|---------------|
| 1 | `worker/src/routes/admin-loyalty.ts` | `tests/admin-loyalty.test.ts` | Hono Router | GET /widgets, GET /tiers, GET /top-customers, GET /export |
| 2 | `worker/src/routes/admin-metrics.ts` | `tests/admin-metrics.test.ts` | Hono Router | GET /?range=24h\|7d\|30d |
| 3 | `worker/src/routes/auth.ts` | `tests/auth.test.ts` | Plain handlers | registerUser, loginUser, logoutUser, getCurrentUser, registerStaff, listStaff, bootstrapOwner, resetPassword, changePassword |
| 4 | `worker/src/routes/customers.ts` | `tests/customers.test.ts` | Hono Router | GET /me, GET / |

## Test Matrix

### admin-loyalty.test.ts (160 lines)

```
describe('Admin Loyalty Routes', () => {
  describe('GET /widgets', () => {
    test('returns 8 KPI widgets with data')     // seed customers, checkins
    test('returns zero values when empty DB')
  })
  describe('GET /tiers', () => {
    test('returns tier distribution with percentages')
    test('handles empty distribution')
  })
  describe('GET /top-customers', () => {
    test('returns top 20 by total_spent')
    test('respects limit query param')
  })
  describe('GET /export', () => {
    test('returns CSV with correct Content-Type header')
    test('escapes double quotes in names')
    test('handles empty results')
  })
})
```

All routes use `requireAuth(['owner', 'admin', 'staff'])` globally — mock the middleware:

```typescript
vi.mock('../worker/src/middleware/auth', () => ({
  requireAuth: () => async (c: any, next: any) => {
    await next();
  },
}));
```

### admin-metrics.test.ts (83 lines)

```
describe('Admin Metrics Routes', () => {
  describe('GET /', () => {
    test('returns metrics for 24h range by default')
    test('returns metrics for 7d range')
    test('returns metrics for 30d range')
    test('returns 400 for invalid range')
    test('returns 500 when _metrics table query fails')
    test('calculates p50 and p95 latency correctly')
    test('returns top 10 paths')
  })
})
```

Mock the `_metrics` table with seed data containing `name`, `tags` (JSON), `value`, `created_at` columns.

### auth.test.ts (504 lines — most complex in this phase)

9 exported functions. Test each independently:

```
describe('Auth Handlers', () => {
  describe('registerUser', () => {
    test('registers new user and returns JWT')
    test('returns 400 on duplicate email')
    test('returns 400 on invalid email format')
    test('returns 400 on short password')
  })
  describe('loginUser', () => {
    test('logs in with correct credentials and returns JWT')
    test('returns 401 with wrong password')
    test('returns 401 for non-existent email')
    test('returns 429 on rate limit exceeded')       // mock KV
  })
  describe('getCurrentUser', () => {
    test('returns user profile from valid JWT')
    test('returns 401 when no authorization header')
    test('returns 401 with invalid token')
  })
  describe('registerStaff', () => {
    test('registers staff account successfully')
    test('returns 400 on duplicate email')
  })
  describe('bootstrapOwner', () => {
    test('creates owner when no owner exists')
    test('returns 400 when owner already exists')
  })
  describe('resetPassword', () => {
    test('sends reset email for known email')
    test('returns 200 even for unknown email (no leak)')
  })
  describe('changePassword', () => {
    test('changes password with valid token')
    test('returns 400 with invalid reset token')
  })
})
```

Auth handlers need mock JWT utilities:
```typescript
vi.mock('../worker/src/lib/jwt', () => ({
  generateJWT: vi.fn(async () => 'mock-jwt-token'),
  verifyJWT: vi.fn(async (token: string) => {
    if (token === 'valid-token') return { email: 'test@test.com', sub: 'user1' };
    return null;
  }),
}));
```

### customers.test.ts (99 lines)

```
describe('Customer Routes', () => {
  describe('GET /me', () => {
    test('returns customer profile with valid JWT')
    test('returns 401 without authorization header')
    test('returns 401 with invalid token')
    test('returns 404 when customer not found')
  })
  describe('GET /', () => {
    test('returns paginated customer list')
    test('filters by search query')
    test('filters by tier')
    test('returns empty list with pagination metadata')
  })
})
```

## Auth Middleware Handling

All admin routes are fully auth-gated. Use Strategy B from Phase 1 (mock `requireAuth`):

```typescript
// In beforeEach:
vi.mock('../worker/src/middleware/auth', () => ({
  requireAuth: () => async (c: any, next: any) => { await next(); },
}));
```

## Success Criteria

- [x] 4 test files created in `tests/`
- [x] Minimum 3 tests per handler group
- [x] Auth mock works for all gated routes
- [x] All existing 770+ tests pass
