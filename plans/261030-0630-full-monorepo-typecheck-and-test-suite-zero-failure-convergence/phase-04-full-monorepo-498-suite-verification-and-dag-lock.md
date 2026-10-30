# Phase 04: Full-Monorepo 498-Suite Verification & DAG Lock

## Context Links
- [Brainstorm Report](../reports/brainstorm-261030-full-monorepo-typecheck-and-test-suite-zero-failure-convergence.md)
- `reports/audit/plan/261029-1703-all-identities/evidence/source-baseline.json`
- `plans/261029-1703-all-identities-login-audit/plan.md`

## Overview
- **Priority:** P0
- **Current Status:** Complete
- **Description:** Run full-monorepo `npm run typecheck:all`, `npm run lint`, `npx vitest run` (all 498 test files), `npx vite build`, and `npm run verify:gates`, then rebaseline `source-baseline.json` and lock all plan/audit artifacts while preserving `UNKNOWN/NOT_RUN` on external cloud gates.

## Requirements
- **Functional:**
  - `npm run typecheck:all` (`typecheck`, `typecheck:worker`, `typecheck:packages`) exits `0`.
  - `npm run lint` exits `0` (`0 errors`).
  - `npx vitest run` passes **498/498 test files** (`0 FAIL`).
  - `source-baseline.json` SHA-256 hashes and `tracked_product_diff_sha256` match the working tree (`audited_source_files_unchanged=true`).
- **Non-Functional:**
  - Keep `DB Admin live`, `real roster`, `deployed origin live`, and `production_readiness` at `UNKNOWN/NOT_RUN` / `NOT_ESTABLISHED`.

## Related Code Files
- Modify: `reports/audit/plan/261029-1703-all-identities/evidence/source-baseline.json`
- Modify: `plans/261029-1703-all-identities-login-audit/plan.md`
- Modify: `reports/audit/plan/261029-1703-all-identities/summary.md`
- Modify: `reports/audit/plan/261029-1703-all-identities/dag-execution.json`

## Implementation Steps
1. Run `npm run typecheck:all` and `npm run lint`.
2. Run `npx vitest run` across all 498 test files.
3. Rebuild `dist/` (`npx vite build --logLevel error`) and verify `npm run verify:gates`.
4. Recompute `source-baseline.json` hashes and synchronize `tracked_product_diff_sha256` in audit plan/summary/DAG files.

## Todo List
- [ ] Verify `npm run typecheck:all` and `npm run lint`
- [ ] Verify `npx vitest run` (498/498 test files)
- [ ] Rebuild `dist/` and verify `npm run verify:gates`
- [ ] Synchronize `source-baseline.json` and plan/audit metadata

## Success Criteria
- `0` errors in `npm run typecheck:all` and `npm run lint`.
- `498/498` test files PASS (`0 FAIL`) in `npx vitest run`.
- `audited_source_files_unchanged=true` on the rebaselined working tree.
