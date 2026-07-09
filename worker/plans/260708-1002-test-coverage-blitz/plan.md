---
status: complete
completed: 2026-07-09
created: 2026-07-08
phases:
- id: 2b-1
  title: Core Tree Modules
  file: phase-2b-1-core-tree-modules.md
  status: complete
  priority: P0
- id: 2b-2
  title: Payment & Integration Routes
  file: phase-2b-2-hybrid-test-coverage.md
  status: complete
  priority: P0
- id: 2b-3
  title: Remaining Routes + Tree
  file: phase-2b-3-remaining-routes-and-tree.md
  status: complete
  priority: P1
---

# Phase 2b: Test Coverage Blitz

## Context
Phase 2 TS Polish is complete (tsc exits 0, 471 tests pass). Scout found 71% route + 79% tree test gap. Security Hardening is safer after tests exist.

## Scope
3 sub-phases covering CRITICAL tree modules → HIGH payment/integration routes → MEDIUM remainder.

## Dependencies
- 2b-1 can start immediately (no blockers)
- 2b-2 can run in parallel with 2b-1 (different files)
- 2b-3 starts after 2b-1 + 2b-2 complete (consolidates learnings)

## Acceptance
- `npx tsc --noEmit` exits 0 throughout
- All new tests pass
- No regression in existing 471 tests
- Coverage: >50% of routes tested (up from 29%)

## Results
- **Final tally:** 1166 tests passing across 111 test files
- **tsc --noEmit:** exits 0
- **Test fixes applied:**
  - `erpnext-client.test.ts`: corrected makeConfig keys (url/apiKey/apiSecret), made createErpnextClientWithKv test async, added .text() to mock Response objects, removed unused NetworkError import and mockFetchErr helper
  - `create-order.test.ts`: changed field name from `table_number` to `table_id` to match Zod schema
