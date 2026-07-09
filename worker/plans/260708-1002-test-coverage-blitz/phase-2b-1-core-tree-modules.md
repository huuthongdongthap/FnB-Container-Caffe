# Phase 2b-1: Core Tree Modules (CRITICAL)

**Goal:** Add unit tests for the first-priority tree modules: `tree/orders/create-order.ts` and `tree/auth/login.ts`. These are the leanest-risk, highest-value targets — financial correctness and auth integrity foundation everything else.

## Files to test
- `src/tree/orders/create-order.ts` — order creation logic (price validation, item parsing, status transitions)
- `src/tree/orders/helpers.ts` — helper utilities used by create-order
- `src/tree/auth/login.ts` — JWT issuance, token signing
- `src/tree/auth/helpers.ts` — auth utility functions

## Existing test patterns to follow
Look at `src/__tests__/routes/orders.test.ts` for route-wrapper test patterns and `src/__tests__/routes/auth.test.ts` for auth patterns. Both already import from `../../lib/db` and use `createMockEnv()`.

## Test file locations
- `src/__tests__/tree/orders/create-order.test.ts`
- `src/__tests__/tree/auth/login.test.ts`
- `src/__tests__/tree/auth/helpers.test.ts`

## Acceptance
- Each tree module has ≥3 test cases covering happy path and at least one error path.
- `npx vitest run` passes (471 existing + new).
- `npx tsc --noEmit` still exits 0.
