# Phase 04: Full Regression, 126-Table Replica Verification & DAG Lock

## Context Links
- Plan Overview: `plans/261030-0315-zero-error-d1-query-priority-and-menu-table-ux-parity/plan.md`
- Replica Cutover Test: `worker/src/__tests__/integrations/loyalty-referrals-inventory-po-cutover.test.ts`

## Overview
- **Priority**: P0 (Zero-Regression Verification & DAG Baseline Lock)
- **Current Status**: Complete
- **Description**: Verify Phases 01–03 across unit tests, 54 worker integration suites, 47 audit probes, 171 auth regressions, 57 local customer/KDS E2E checks, TypeScript strict check, production builds, and planning DAG baseline lock while keeping remote cloud/D1 execution gated (`UNKNOWN/NOT_RUN`).

## Requirements
- **Functional**:
  - Extend `loyalty-referrals-inventory-po-cutover.test.ts` to verify `/api/tables`, `/api/erpnext/vendors`, and `/api/dindin/carts` execute against the 126-table replica with zero `no such table` fallback errors.
  - Run unit tests for `menu-drink-images`, `RecommendationSection`, and `TableOrder`.
  - Re-run audit probes (`47/47`), auth regressions (`171/171`), worker integration suites (`418+/418+`), `tsc --noEmit`, `npm run build`, and `run-local-planning-dag.py`.

## Related Code Files
- Modify: `worker/src/__tests__/integrations/loyalty-referrals-inventory-po-cutover.test.ts`

## Todo List
- [x] Add replica assertions for `/api/tables`, `/api/erpnext/vendors`, and `/api/dindin/carts` in `loyalty-referrals-inventory-po-cutover.test.ts`
- [x] Run full frontend & worker test suites, typecheck, and build
- [x] Update `source-baseline.json` and run `run-local-planning-dag.py`

## Success Criteria
- 100% pass rate across all local unit, integration, and browser E2E suites (`0 FAIL`).
- Cloud/Live gates (`DB_ADMIN_LIVE`, `REAL_STAFF_ROSTER`, `DEPLOYED_ORIGIN_LIVE`, `PRODUCTION_READINESS`) remain explicitly `UNKNOWN/NOT_RUN`.
