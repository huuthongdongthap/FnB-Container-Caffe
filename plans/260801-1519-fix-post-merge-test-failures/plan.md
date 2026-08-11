# Post-Merge Test Failure Fix Plan

## Goal
Fix 120 failing tests (31 files) after merging remote commit `03c59e1`.

## Current State
- Build: PASS ✓
- Tests: 2439 pass / 120 fail / 2559 total
- Root cause: auth mock path mismatch + missing route implementations + merge artifact

## Phases
1. Fix auth mocks (shifts, reports, customers, orders, erpnext, mautic, integration)
2. Fix tables.test.ts qrRouter.fetch undefined
3. Add missing routes to reports.js or align tests
4. Add missing DB migration tables for integration tests
5. Run full test suite, verify 0 failures

## Dependencies
- Phase 1 → 2 → 3 → 4 → 5 (sequential)
