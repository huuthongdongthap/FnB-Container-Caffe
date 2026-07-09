# Tree Domain Test Coverage — Money-Path Modules

**Branch:** main | **Status:** ✅ complete (1246 tests, 0 failures) | **Created:** 2026-07-09

## Phases

| # | Phase | Effort | Dependencies |
|---|-------|--------|--------------|
| 1 | Loyalty module tests | 20 min | — | ✅ complete |
| 2 | Orders module tests | 25 min | 1 | ✅ complete |
| 3 | Referrals module tests | 20 min | 2 | ✅ complete |

## Acceptance Criteria

- [x] `npx vitest run` → 1246 tests (61+ new cases, exceeded 1225 target)
- [x] 0 failures
- [x] Loyalty: cashback calc, point lookup, process-order happy + error paths tested
- [x] Orders: order creation, split, telegram notify happy + error paths tested
- [x] Referrals: code generation, validation, cashback logic happy + error paths tested

## Scope Boundary

- IN: unit tests for tree/loyalty/*, tree/orders/*, tree/referrals/* only
- OUT: integration tests, E2E, client layer (erpnext/frigate), routes, frontend

## Touchpoints

- `src/tree/loyalty/cashback.ts` — cashback calculation
- `src/tree/loyalty/points.ts` — point accrual/redemption
- `src/tree/loyalty/lookup.ts` — customer loyalty lookup
- `src/tree/loyalty/process-order.ts` — loyalty-driven order processing
- `src/tree/orders/create.ts` — order creation
- `src/tree/orders/split.ts` — order splitting
- `src/tree/orders/update.ts` — order state updates
- `src/tree/orders/telegram.ts` — Telegram notification
- `src/tree/referrals/code.ts` — referral code generation/validation
- `src/tree/referrals/cashback.ts` — referral cashback logic
- `src/tree/referrals/tracker.ts` — referral attribution tracking
- All follow test-utils pattern: `createMockEnv`, D1 closure mocks, `vi` for async

## Non-Negotiable Constraints

- YAGNI: one test per happy path + 2 error cases per exported function
- Existing 1185 tests must pass (no regressions)
- Follow `src/__tests__/tree/*` pattern already established
- No new dependencies
