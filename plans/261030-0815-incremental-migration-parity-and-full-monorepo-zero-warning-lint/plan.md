# Plan: Incremental Migration 3-Way Schema Parity & Full-Monorepo Zero-Warning Lint

**Plan ID:** `261030-0815-incremental-migration-parity-and-full-monorepo-zero-warning-lint`
**Created:** 2026-10-30
**Brainstorm Report:** [brainstorm-261030-incremental-migration-parity-and-full-monorepo-zero-warning-lint.md](../reports/brainstorm-261030-incremental-migration-parity-and-full-monorepo-zero-warning-lint.md)
**Baseline Commit:** `9f7e0bd98c2503cb0c98e40a96e05b2f5e62f654`

## Overview

Converge FnB-Container-Caffe to 100% 3-way schema parity (`worker/schema.sql` == `db/schema.sql` == `createProductionReplica() + migrations` across all 124 tables and all columns) and 0 ESLint warnings across the entire monorepo (`eslint worker/src/ src/ --max-warnings=0`):
1. Create forward/rollback migration pair `20261030_02_replica_schema_parity_and_waste_log_cutover.sql` (+ `.down.sql`) adding `waste_log` and the 53 missing columns across 19 tables in incremental migrations, plus backfilling `loyalty_accounts` (`points_balance`, `referral_code`, `referred_by`) and `tier_configs` (`multiplier`, `benefits`).
2. Clean all 123 ESLint warnings across 96 files in `src/` so `npx eslint worker/src/ src/ --max-warnings=0` passes with `0 errors, 0 warnings`.
3. Add 3-way 124-table + column parity and `GET /api/loyalty/admin/accounts?search=` regression tests, run full verification (`npm run typecheck:all`, `npx vitest run`, `npx vite build --logLevel error`, `npm run verify:gates`), and rebaseline `source-baseline.json`.

## Phases

| Phase | Name | Status | File |
|---|---|---|---|
| 01 | Migration `20261030_02` 3-Way Schema Parity | Complete | [phase-01-migration-20261030-02-three-way-schema-parity.md](./phase-01-migration-20261030-02-three-way-schema-parity.md) |
| 02 | Frontend `src/` Zero-Warning ESLint Convergence | Complete | [phase-02-frontend-src-zero-warning-eslint-convergence.md](./phase-02-frontend-src-zero-warning-eslint-convergence.md) |
| 03 | Regression Tests, Full Verification & Baseline Lock | Complete | [phase-03-regression-tests-and-full-monorepo-verification.md](./phase-03-regression-tests-and-full-monorepo-verification.md) |

## Key Dependencies
- Phases 01 and 02 touch disjoint file sets (`worker/db/migrations/*` vs `src/**`).
- Phase 03 verifies both phases across the full test suite and locks `source-baseline.json`.
