---
title: "Test Coverage Blitz — Route + Lib Test Implementation"
description: "Add unit tests for 28 untested route files and 1 untested lib client, following existing mock patterns"
status: completed
priority: P2
effort: 16h
branch: main
tags: [testing, vitest, routes, coverage]
created: 2026-07-02
---

# Test Coverage Blitz — Overview

## Current State

| Metric | Count |
|--------|-------|
| Total route files | 35 |
| Tested routes | 7 (cal-booking-webhook, health, mautic-bridge, mixpost, pretix, signage, subscriptions) |
| Untested routes | 28 |
| Lib test files | 8 (erpnext-client, mautic-client, resend-client, speedsms-client, parser, email, campaign-triggers, integration) |
| Untested lib files | 1 (cal-booking-client) |
| Existing tests | 770 (all passing) |
| Build errors | 0 |

## Phase Summary

| Phase | Routes | Actual Tests | Effort | Priority | Status |
|-------|--------|-------------|--------|----------|--------|
| Phase 1: Customer-facing | 12 | ~120 | 6h | P1 | completed |
| Phase 2: Operational | 12 | ~100 | 5h | P2 | completed |
| Phase 3: Admin | 4 | ~35 | 2h | P3 | completed |
| Phase 4: Lib client | 1 | ~8 | 1.5h | P2 | completed |
| Phase 5: Regression gate | — | — | 1.5h | P1 | completed |

## Dependency Graph

```
Phase 1 ──┬── Phase 2 ──┬── Phase 4 ── Phase 5
          │             │
          └── Phase 3 ──┘
```

Phases 1-3 are independent of each other (no shared route files). Phases 2+3 depend on Phase 1 establishing test patterns. Phase 4 is independent. Phase 5 gates everything.

## Test File Naming

`tests/{route-name}.test.ts` — matches route filename (e.g., `checkin.test.ts`, `reports.test.ts`)

## Mock Pattern (from existing tests)

### D1 Database
```typescript
function createMockD1(seedData: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = { ...seedData };
  const db = {
    prepare: vi.fn((q: string) => ({
      _sql: q, _bindValues: [] as any[],
      bind: vi.fn(function (...vals: any[]) { this._bindValues.push(...vals); return this; }),
      first: vi.fn(async function () { ... }),
      all: vi.fn(async function () { return { results: [...] }; }),
      run: vi.fn(async function () { return { success: true }; }),
    })),
  };
  return db;
}
```

### Fetch
```typescript
globalThis.fetch = vi.fn();
// Success: mockFetch.mockResolvedValue(new Response(JSON.stringify(data)))
// Error: mockFetch.mockResolvedValue(new Response(body, { status: 500 }))
```

### Router Mount
```typescript
// Hono routers: import router, call router.request('/path', { method, headers, body }, env)
// Plain handlers: import handler, call handler(request, env, ctx)
```

## Results

**Completed:** 2026-07-02

| Metric | Before | After |
|--------|--------|-------|
| Test files | 17 (tests/) | 46 (tests/) |
| Total tests | 770 | 1033 |
| New tests added | -- | +263 |
| Build errors | 0 | 0 |

All phases completed successfully. Full regression gate passed: 1033/1033 tests passing, 0 build errors.

## Success Criteria

- [x] 29 new test files created in `tests/`
- [x] Minimum 3 tests per route (happy path, validation error, not-found/edge case)
- [x] All 770+ existing tests still pass
- [x] `npm run build` exits 0
- [x] `npx vitest run` exits 0
- [ ] 28 new test files created in `tests/`
- [ ] Minimum 3 tests per route (happy path, validation error, not-found/edge case)
- [ ] All 770+ existing tests still pass
- [ ] `npm run build` exits 0
- [ ] `npx vitest run` exits 0

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| D1 mock too simplistic for complex queries | Medium | Medium | Study createMockD1 patterns from pretix-bridge; extend as needed |
| Auth middleware blocks route tests | Medium | Low | Mock JWT verification or use .request() with mock context |
| Build breaks from TypeScript errors | Low | High | Run `npx tsc --noEmit` after each phase |
| Existing test regressions | Low | High | Run full test suite after each phase |

## Phase Files

- [Phase 1: Customer-facing Routes](phase-01-customer-facing-routes.md) — 12 routes, highest priority
- [Phase 2: Operational Routes](phase-02-operational-routes.md) — 12 routes
- [Phase 3: Admin Routes](phase-03-admin-routes.md) — 4 routes
- [Phase 4: Lib Client Tests](phase-04-lib-client-tests.md) — 1 lib
- [Phase 5: Regression Gate](phase-05-regression-gate.md) — full verification
