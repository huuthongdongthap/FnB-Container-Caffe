---
status: complete
completed: 2026-07-09
created: 2026-07-08
phases:
  - id: 2b-3a
    title: Subscriptions Tree (7 files)
    file: phase-2b-3a-subscriptions.md
    status: pending
    priority: P0
  - id: 2b-3b
    title: Orders Tree (5 files)
    file: phase-2b-3b-orders.md
    status: pending
    priority: P0
  - id: 2b-3c
    title: Campaigns + Loyalty + Zalo (9 files)
    file: phase-2b-3c-campaigns-loyalty.md
    status: pending
    priority: P1
  - id: 2b-3d
    title: Mautic + Final Gate (10 files)
    file: phase-2b-3d-mautic-final.md
    status: pending
    priority: P2
---

# Phase 2b-3: Remaining Tree Coverage — Full Close

## Context
After 2b-1, 2b-2, and task #18: 847 tests passing, 0 regressions.
Route coverage >50% target met (34/63 = 54%).
Tree coverage remains: 30 tested / 94 total = 32%.

## Goal
Add tests for all remaining 32 untested tree files (~2,700 lines).
Target: 50-80 new tests. All existing tests continue passing.

## Approach
One test file per source file. Patterns from 2b-1 and 2b-2:
- `vi.stubGlobal('fetch', fn)` for HTTP
- D1 closure mock: `{ prepare: (sql) => ({ bind: () => ({ first, all, run }) }) }`
- KV mock: `{ get, put, delete }` plain object
- Zero `:any` types via `Parameters<>[0]['type']` or `import()` type assertions
- ESM `.js` extensions on all imports
- Zero `console.*`

## Phase Dependencies
2b-3a and 2b-3b independent → can parallelize
2b-3c depends on 2b-3a (subscriptions middleware shared)
2b-3d independent → can parallelize with 3a/3b

## Acceptance
- `npx vitest run` → 897-927 tests passing, 0 regressions
- `git diff --stat` shows only new test files
- `npx tsc --noEmit` exits 0

## Rollback
Delete all files in `src/__tests__/tree/subscriptions/`, `src/__tests__/tree/orders/`, `src/__tests__/tree/campaigns/`, `src/__tests__/tree/loyalty/`, `src/__tests__/tree/zalo/`, `src/__tests__/tree/mautic/`.
