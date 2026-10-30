# Plan: Full-Monorepo Typecheck & 498-Suite Zero-Failure Convergence

**Plan ID:** `261030-0630-full-monorepo-typecheck-and-test-suite-zero-failure-convergence`
**Created:** 2026-10-30
**Brainstorm Report:** [brainstorm-261030-full-monorepo-typecheck-and-test-suite-zero-failure-convergence.md](../reports/brainstorm-261030-full-monorepo-typecheck-and-test-suite-zero-failure-convergence.md)
**Baseline Commit:** `9f7e0bd98c2503cb0c98e40a96e05b2f5e62f654` (`tracked_product_diff_sha256: 70ee465b21bce7f49641a62d3e7631f5213a154a949664d6373c8d97012aa889`)

## Overview

Converge the entire FnB-Container-Caffe monorepo to **0 errors** across `npm run typecheck:all` (`typecheck`, `typecheck:worker`, `typecheck:packages`), `npm run lint`, and **498/498 Vitest test files (`4,718` tests)** while preserving all security, D1 authority, and PayOS/COD business invariants:
1. Fix the production staff push subscription authentication defect in `worker/src/routes/push.ts` and `worker/src/middleware/auth.ts` (`TS2459` unexported `authenticateRequest` + `payload.role` extraction) and align `worker/src/__tests__/routes/checkin.test.ts`.
2. Align `tests/promotions.test.ts` with the `POST /api/promotions/redeem` order-existence check (`orders` seed in `createMockD1` + explicit `404` non-existent order assertion) and align `worker/src/__tests__/tree/orders/update-order.test.ts` with the `confirmed → preparing` unpaid-delivery kitchen gate query.
3. Align the 3 legacy delivery order test fixtures (`worker/src/__tests__/lib/validators.test.ts`, `worker/src/__tests__/integrations/order-persistence-tamper-schema.test.ts`, `worker/src/__tests__/routes/orders-snapshot.test.ts`) with the `delivery` PayOS-prepaid business policy (`payment_method: 'payos'`) and add an explicit negative test for `delivery` + `cod`.
4. Verify `npm run typecheck:all`, `npm run lint`, full `npx vitest run` (`498/498` test files, `4,718/4,718` tests), `npm run verify:gates`, and rebaseline `source-baseline.json` while keeping external cloud gates `UNKNOWN/NOT_RUN`.

## Phases

| Phase | Name | Status | File |
|---|---|---|---|
| 01 | Worker Push Auth Contract & `typecheck:worker` Fix | Complete | [phase-01-worker-push-auth-contract-and-typecheck-fix.md](./phase-01-worker-push-auth-contract-and-typecheck-fix.md) |
| 02 | Promotions `/redeem` & Order Transition Test Alignment | Complete | [phase-02-promotions-redeem-and-order-transition-test-alignment.md](./phase-02-promotions-redeem-and-order-transition-test-alignment.md) |
| 03 | Delivery PayOS-Prepaid Policy Test Convergence | Complete | [phase-03-delivery-payos-prepaid-policy-test-convergence.md](./phase-03-delivery-payos-prepaid-policy-test-convergence.md) |
| 04 | Full-Monorepo 498-Suite Verification & DAG Lock | Complete | [phase-04-full-monorepo-498-suite-verification-and-dag-lock.md](./phase-04-full-monorepo-498-suite-verification-and-dag-lock.md) |

## Key Dependencies
- Phases 01, 02, and 03 own strictly disjoint files and can execute in parallel without conflict.
- Phase 04 depends on Phases 01–03 and locks the full-monorepo verification and `source-baseline.json` SHA-256 hashes.
