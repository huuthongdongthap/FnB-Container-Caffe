# Brainstorm: Phase 2b-3 Full Close

**Date:** 2026-07-08 20:14
**Status:** Approved by user ("yea all")
**Decision:** Option A — full close, all remaining tree files

## Scope Summary

**Baseline:** 847 tests passing, 0 regressions after 2b-1+2b-2+18
**Remaining untested tree:** 36 files, ~2,826 lines

## File Groups

| Group | Files | Lines | Priority | Notes |
|-------|-------|-------|----------|-------|
| subscriptions | 7 | 688 | High | sub-handlers 344L, plan-handlers 94L, invoice-handlers 85L |
| orders | 5 (new) | 465 | High | update-order 210L, stats 85L |
| campaigns | 3 (new) | 450 | Med | campaign-engine 62L, cron-handler 194L |
| loyalty | 5 (new) | 226 | Med | lookup-handler 77L, campaign 16L (already tested: process-order, helpers, summary, spend) |
| mautic | 10 | 535 | Low | External API — heavy fetch mocking, deferred rationale from 2b-2 |
| zalo | 1 (new) | 41 | Low | notify-member.ts |

## Test File Targets (new)

- `src/__tests__/tree/subscriptions/helpers.test.ts`
- `src/__tests__/tree/subscriptions/plan-handlers.test.ts`
- `src/__tests__/tree/subscriptions/invoice-handlers.test.ts`
- `src/__tests__/tree/subscriptions/mrr-calculator.test.ts`
- `src/__tests__/tree/subscriptions/sub-handlers.test.ts`
- `src/__tests__/tree/subscriptions/middleware.test.ts`
- `src/__tests__/tree/subscriptions/types.test.ts`
- `src/__tests__/tree/orders/get-order.test.ts`
- `src/__tests__/tree/orders/update-order.test.ts`
- `src/__tests__/tree/orders/stats.test.ts`
- `src/__tests__/tree/orders/helpers.test.ts` *(if not already)*
- `src/__tests__/tree/orders/split-orders.test.ts` *(if not already)*
- `src/__tests__/tree/orders/telegram.test.ts`
- `src/__tests__/tree/orders/notify-order-status.test.ts`
- `src/__tests__/tree/orders/admin-orders.test.ts`
- `src/__tests__/tree/campaigns/campaign-engine.test.ts`
- `src/__tests__/tree/campaigns/cron-handler.test.ts`
- `src/__tests__/tree/campaigns/templates.test.ts`
- `src/__tests__/tree/loyalty/auth-middleware.test.ts`
- `src/__tests__/tree/loyalty/phone-auth-handler.test.ts`
- `src/__tests__/tree/mautic/client-factory.test.ts`
- `src/__tests__/tree/mautic/campaign-enrollment.test.ts`
- `src/__tests__/tree/mautic/enrollment-tracker.test.ts`
- `src/__tests__/tree/mautic/sync-state.test.ts`
- `src/__tests__/tree/mautic/bridge-handler.test.ts`
- `src/__tests__/tree/mautic/campaign-detection.test.ts`
- `src/__tests__/tree/mautic/contact-mapper.test.ts`
- `src/__tests__/tree/mautic/promo-campaign.test.ts`
- `src/__tests__/tree/mautic/segment-sync.test.ts`
- `src/__tests__/tree/mautic/contact-sync.test.ts`
- `src/__tests__/tree/mautic/contact-sync-cron.test.ts`
- `src/__tests__/tree/mautic/types.test.ts`
- `src/__tests__/tree/zalo/notify-member.test.ts`

**Estimated tests:** 50-80 (depends on function granularity per file)

## Constraints

- Zero `:any`, zero `console.*`, ESM `.js` extensions
- Tests only, no source changes
- `npx vitest run` must pass with 0 regressions from 847 baseline

## Risks

1. **sub-handlers.ts** (344L) — complex disco→subscription state machine with external payment API calls. Heavy mocking required.
2. **update-order.ts** (210L) — multiple state transitions, inventory reconciliation.
3. **mautic/** — 10 files, all HTTP-heavy. Tests will be brittle if mautic API shape changes.
4. Minute-level mock volume — 80+ new test files will strain CI time.

## Unresolved Questions

- Should mautic tests mock at fetch level or use a shared mock client factory?
- Should combined-small-files strategy be used for zalo types + loyalty campaign (14L each)?
