# Sprint 13: Mega-Component Modularization Round 4

**Date:** 2026-08-15 | **Status:** PLANNING

## Context

Health report claimed "0 files > 200 LOC" but only tracked `components/stitch/`. Audit reveals 65 source files over 200 LOC across the entire codebase. Sprint 13 targets the top 8 largest.

## Targets (Top 8 by LOC)

| # | File | LOC | Area |
|---|------|-----|------|
| 1 | `pages/stitch/mobile/index.tsx` | 432 | Mobile ordering |
| 2 | `pages/stitch/referral-rewards-2/index.tsx` | 414 | Referral program |
| 3 | `components/stitch/StitchAdminLoginNew.tsx` | 401 | Admin login |
| 4 | `pages/ReviewsPage.tsx` | 395 | Customer reviews |
| 5 | `components/stitch/StitchReservationNew.tsx` | 376 | Reservation |
| 6 | `pages/admin/Staff.tsx` | 347 | Staff management |
| 7 | `pages/TableOrder.tsx` | 347 | Table ordering |
| 8 | `pages/admin/BroadcastPage.tsx` | 341 | Broadcast/messaging |

## Execution Strategy

8 parallel agents, each modularizing one file. Target: all extracted sub-files under 200 LOC, orchestrator under 100 LOC.

## Verification

- `npx tsc --noEmit` — zero new errors
- `npx vitest run` — all 3026 tests pass
- No route import changes
