# Plan: Schema Bootstrap Parity, Legacy Fallback Hardening & Zero-Warning Worker Convergence

**Plan ID:** `261030-0730-schema-bootstrap-parity-and-legacy-fallback-hardening`
**Created:** 2026-10-30
**Brainstorm Report:** [brainstorm-261030-schema-bootstrap-parity-and-legacy-fallback-hardening.md](../reports/brainstorm-261030-schema-bootstrap-parity-and-legacy-fallback-hardening.md)
**Baseline Commit:** `9f7e0bd98c2503cb0c98e40a96e05b2f5e62f654` (`tracked_product_diff_sha256: d052b0586955a95327493c3493fb3bec7edb6e8233b11cf5bc69a8dfe20ac314`)

## Overview

Converge the FnB-Container-Caffe monorepo to 100% SQL compilation parity across both fresh `worker/schema.sql` bootstrap and incremental forward migrations (`worker/db/migrations/*.sql`), eliminate unguarded legacy table (`shifts`/`tables`) fallback exceptions on canonical D1, and bring `worker/src/` to `0` ESLint warnings:
1. Create forward/rollback migration pair `20261030_02_schema_bootstrap_and_loyalty_erpnext_column_parity.sql` (+ `.down.sql`) and reconcile `worker/schema.sql` + `db/schema.sql` so every canonical table and column in the 126-table production replica exists in both bootstrap and migrated schemas.
2. Harden legacy table fallbacks in `packages/domain/shift/src/policies/cash-reconciliation-policy.ts`, `worker/src/tree/analytics/zone-analytics.ts`, `worker/src/routes/tables-mobile.ts`, and `worker/src/routes/customer-assistant.ts`.
3. Clean the 6 unused-symbol ESLint warnings in `worker/src/` and add empirical SQL/handler regression tests in `loyalty-referrals-inventory-po-cutover.test.ts` and `web-payment-and-staging-gates.test.ts`.
4. Verify `npm run typecheck:all`, `npm run lint`, full `npx vitest run` (498/498 test files), `npm run verify:gates`, and rebaseline `source-baseline.json` while keeping external cloud gates `UNKNOWN/NOT_RUN`.

## Phases

| Phase | Name | Status | File |
|---|---|---|---|
| 01 | Canonical Schema & Migration `20261030_02` Parity | Complete | [phase-01-canonical-schema-and-migration-20261030-02-parity.md](./phase-01-canonical-schema-and-migration-20261030-02-parity.md) |
| 02 | Legacy Fallback Hardening (`shifts` & `tables`) | Complete | [phase-02-legacy-fallback-hardening.md](./phase-02-legacy-fallback-hardening.md) |
| 03 | Worker Zero-Warning ESLint & Regression Tests | Complete | [phase-03-worker-eslint-zero-warning-and-regression-tests.md](./phase-03-worker-eslint-zero-warning-and-regression-tests.md) |
| 04 | Full-Monorepo Verification & Audit Baseline Lock | Complete | [phase-04-full-monorepo-verification-and-baseline-lock.md](./phase-04-full-monorepo-verification-and-baseline-lock.md) |

## Key Dependencies
- Phases 01, 02, and 03 own disjoint file sets and can be executed in parallel.
- Phase 04 runs after Phases 01–03 complete to verify all gates and rebaseline `source-baseline.json`.
