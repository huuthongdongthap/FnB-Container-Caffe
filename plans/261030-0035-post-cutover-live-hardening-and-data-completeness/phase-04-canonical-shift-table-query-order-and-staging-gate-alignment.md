# Phase 04: Canonical Shift Table Query Priority & Regression Tests

## Context Links
- Brainstorm Report: `plans/reports/brainstorm-261030-post-cutover-live-hardening-and-data-completeness.md`
- Shift Cash Reconciliation Policy: `packages/domain/shift/src/policies/cash-reconciliation-policy.ts`
- Shift Lifecycle Policy: `packages/domain/shift/src/policies/shift-lifecycle-policy.ts`

## Overview
- **Priority**: P1 (Eliminate unnecessary failing D1 queries to non-existent `shifts` table on shift close/reconciliation)
- **Current Status**: Done (Local Replica & Staging Gate Verified)
- **Description**: `cash-reconciliation-policy.ts:36-50` (`getShiftWindow`) currently queries `SELECT clock_in, clock_out FROM shifts WHERE id = ?` before `staff_shifts`. Because production D1 uses `staff_shifts` (and has no `shifts` table), every shift reconciliation triggers two caught D1 `no such table: shifts` errors before reading `staff_shifts`.

## Key Insights
- `shift-lifecycle-policy.ts` already queries `staff_shifts` first (`lines 45, 86, 138, 161, 183, 216`) and only falls back to `shifts` in `catch` blocks for legacy test mocks.
- Aligning `getShiftWindow()` in `cash-reconciliation-policy.ts` to query `staff_shifts` first makes both shift policies 100% consistent and eliminates the only remaining non-existent table query in production execution paths.

## Requirements
- **Functional**:
  - Query `SELECT clock_in, clock_out FROM staff_shifts WHERE id = ?` first in `getShiftWindow()`.
  - Keep `SELECT clock_in, clock_out FROM shifts WHERE id = ?` and `COALESCE(actual_start, start_time)` as secondary fallbacks so all existing unit tests with legacy `shifts` mocks continue to pass.
- **Non-Functional**:
  - 100% backward-compatible with `packages/domain/shift` and `worker/src/__tests__` test suites.

## Architecture
- `reconcileShiftCash` → `getCashPaymentsForShift` & `getCashPayoutsForShift` → `getShiftWindow` → queries `staff_shifts` (0 errors on live D1) → falls back to `shifts` only if `staff_shifts` is absent in a unit test mock.

## Related Code Files
- Modify: `packages/domain/shift/src/policies/cash-reconciliation-policy.ts`
- Test: `worker/src/__tests__/integrations/loyalty-referrals-inventory-po-cutover.test.ts`

## Implementation Steps
1. In `packages/domain/shift/src/policies/cash-reconciliation-policy.ts:31-61`, reorder `getShiftWindow()` so `SELECT clock_in, clock_out FROM staff_shifts WHERE id = ?` executes first, followed by the legacy `shifts` fallback queries.
2. Run shift domain and worker integration tests to verify zero regressions.

## Todo List
- [x] Reorder `getShiftWindow()` in `packages/domain/shift/src/policies/cash-reconciliation-policy.ts`
- [x] Align `worker/src/__tests__/routes/web-payment-and-staging-gates.test.ts` migration counts (`57` forward, `15` down) and run shift unit and integration tests

## Success Criteria
- `getShiftWindow()` hits `staff_shifts` on the first query in production D1 without throwing on `shifts`.
- All existing shift reconciliation unit tests pass.

## Risk Assessment
- **Risk**: Unit tests that mock both `staff_shifts` (empty) and `shifts` (populated).
- **Mitigation**: `if (staffShift) return staffShift;` falls through to the `shifts` query when `staff_shifts` returns `null` or throws.

## Security Considerations
- No auth or permission changes; internal shift window lookup only.

## Next Steps
- Proceed to Phase 05 for remote D1 migration execution, Worker/Pages redeploy, and live verification.
