---
title: "File Size Reduction — Tree-Layer Extraction"
description: "Split 10 oversized route files (>200 lines) into tree/<domain>/ modules following 4-layer architecture"
status: completed
priority: P2
effort: 16h
branch: main
tags: [refactor, tree-layer, file-size, code-health]
created: 2026-07-02
source: /Users/macbook/FnB-Container-Caffe/plans/reports/brainstorm-260702-0250-file-size-reduction.md
---

## Overview

10 route files exceed the 200-line limit. Extract business logic → `worker/src/tree/<domain>/` modules. Routes become thin Hono routers (50-80 lines).

## Current State

| File | Lines | Over By |
|------|-------|---------|
| `subscriptions.ts` | 704 | +504 |
| `loyalty.ts` | 640 | +440 |
| `orders.ts` | 548 | +348 |
| `mautic-bridge.ts` | 533 | +333 |
| `auth.ts` | 504 | +304 |
| `mixpost.ts` | 468 | +268 |
| `referrals.ts` | 320 | +120 |
| `pretix.ts` | 276 | +76 |
| `zalo.ts` | 229 | +29 |
| `cal-booking-webhook.ts` | 227 | +27 |

Tests: 1,033 (104 files). Build: 0 errors.

## Phase Summary

| Phase | Files | Effort | Priority |
|-------|-------|--------|----------|
| 1: Largest files | 5 (subscriptions, loyalty, orders, auth, mautic-bridge) | 8h | P0 |
| 2: Medium files | 3 (mixpost, referrals, pretix) | 4h | P1 |
| 3: Small cleanup | 2 (zalo, cal-booking-webhook) | 2h | P2 |
| 4: Regression gate | — | 1h | P0 |

## TDD Contract

**Every step:** verify current tests → extract module → verify tests stay green → commit

1. Run `npm test` before extraction — confirm 1,033 ✓
2. Create tree module with extracted business logic
3. Update route file to import from tree module
4. Route file re-exports everything via `export { ... } from '../tree/...'` (preserves import paths in index.ts and tests)
5. Run `npm test` after extraction — must stay 1,033 ✓
6. Commit per file

## Files Touched (Per Phase)

### Phase 1: Largest Files
- `worker/src/routes/subscriptions.ts` → reduce to ~50 lines
- `worker/src/routes/loyalty.ts` → reduce to ~60 lines  
- `worker/src/routes/orders.ts` → reduce to ~70 lines
- `worker/src/routes/auth.ts` → reduce to ~45 lines
- `worker/src/routes/mautic-bridge.ts` → reduce to ~90 lines
- **25+ new tree files** in `worker/src/tree/<domain>/`
- **NO changes to `worker/src/index.ts`** (re-exports preserve contracts)

### Phase 2: Medium Files
- `worker/src/routes/mixpost.ts` → reduce to ~110 lines
- `worker/src/routes/referrals.ts` → reduce to ~60 lines
- `worker/src/routes/pretix.ts` → reduce to ~85 lines

### Phase 3: Small Cleanup
- `worker/src/routes/zalo.ts` → reduce to ~70 lines
- `worker/src/routes/cal-booking-webhook.ts` → reduce to ~75 lines

## Success Criteria

- [ ] All 10 route files ≤ 200 lines
- [ ] 1,033 tests pass (0 regressions, 0 new failures)
- [ ] `npm run build` → 0 errors
- [ ] `npx tsc --noEmit` (worker) → 0 errors
- [ ] All exports from routes/ preserved (import paths in index.ts unchanged)
- [ ] No new `:any` types introduced
- [ ] Tree modules follow layer rules (import seed/lib only, no circular deps)

## Rollback

Per-file granularity — `git checkout` any single file and its test still passes. Each extraction is independent.

## Phase Files

- [Phase 1: Largest Files](phase-01-largest-files.md) — subscriptions, loyalty, orders, auth, mautic-bridge
- [Phase 2: Medium Files](phase-02-medium-files.md) — mixpost, referrals, pretix
- [Phase 3: Small Cleanup](phase-03-small-cleanup.md) — zalo, cal-booking-webhook
- [Phase 4: Regression Gate](phase-04-regression-gate.md) — full verification
