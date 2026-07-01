---
phase: 1
title: TDD Gate (Worker + Frontend Tests)
status: completed
priority: P1
dependencies: []
effort: 1h
---

# Phase 1: TDD Gate — Worker + Frontend Tests

## Overview

Write tests capturing current payment behavior BEFORE making changes. Worker tests for `create-link` and webhook handler. Frontend tests for checkout PayOS flow and order-success polling. All tests must FAIL or validate current behavior before Phase 2-4 implementation.

## Requirements

- Functional: Tests must cover success, error, and edge cases for create-link + webhook + checkout PayOS flow
- Non-functional: Tests must run in CI without external PayOS API (mock fetch)

## Architecture

```
worker/src/__tests__/routes/payments.test.ts  ← Extend: idempotency, returnUrl tests
worker/src/__tests__/routes/webhooks.test.ts   ← Extend: DLQ tests
src/hooks/stores/__tests__/use-payment-store.test.ts  ← NEW: retry, timeout
src/pages/__tests__/checkout-payos.test.tsx     ← NEW: PayOS flow UI tests
src/pages/__tests__/order-success-polling.test.tsx ← NEW: polling timeout test
```

## Related Code Files

- Create: `src/hooks/stores/__tests__/use-payment-store.test.ts`
- Create: `src/pages/__tests__/checkout-payos.test.tsx`
- Create: `src/pages/__tests__/order-success-polling.test.tsx`
- Modify: `worker/src/__tests__/routes/payments.test.ts`
- Modify: `worker/src/__tests__/routes/webhooks.test.ts`

## Implementation Steps

### Worker Tests

1. **Read existing worker tests** — `worker/src/__tests__/routes/payments.test.ts` and `webhooks.test.ts`
2. **Add idempotency test** — mock D1 to return existing payment row, verify 409 Conflict returned
3. **Add returnUrl test** — verify `returnUrl` in PayOS payload uses React route pattern (not `checkout.html`)
4. **Add DLQ test** — mock KV, trigger webhook error, verify KV key `webhook:dlq:*` written
5. **Add signature failure test** — verify 401 on invalid HMAC signature
6. **Run worker tests** — `cd worker && npx vitest run` — all must pass

### Frontend Tests

7. **Create `use-payment-store.test.ts`** — test `createPaymentLink` success/error/idempotency-key
8. **Create `checkout-payos.test.tsx`** — test PayOS button click → loading state → success redirect → error retry button
9. **Create `order-success-polling.test.tsx`** — test polling starts on mount, stops on terminal status, stops after 10min timeout
10. **Run frontend tests** — `npx vitest run` — 410 existing + new tests must pass

## Success Criteria

- [ ] Worker tests: idempotency, returnUrl, DLQ, signature failure — all pass
- [ ] Frontend tests: use-payment-store, checkout-payos, order-success-polling — all pass
- [ ] `cd worker && npx vitest run` — 100% pass
- [ ] `npx vitest run` (frontend) — 410+ tests pass
- [ ] All new tests FAIL when implementation is reverted (prove tests catch regressions)

## TDD Notes

- Use `vi.hoisted()` pattern for mock variables (established pattern from Phase 6 testing)
- Mock `fetch` globally, not per-test, to avoid hoisting issues
- Worker tests mock D1 with `c.env.AURA_DB = { prepare: vi.fn(), ... }`
- Frontend store tests use `Object.assign(vi.fn(), { getState, setState })` for Zustand mocks

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Worker test env differs from CF Workers runtime | Use Miniflare or vitest-environment-miniflare if available; otherwise mock `c.env` bindings |
| Test pollution between payment store tests | Reset store state in `beforeEach` via `usePaymentStore.setState({ ...initialState })` |
