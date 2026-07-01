# Housekeeping Sprint — Brainstorm Report

**Date:** 2026-07-01 | **Mode:** deep + parallel | **Researchers:** 3 (dual routes, index divergence, dead code + hygiene)

## Problem Statement

Codebase has accumulated technical debt from rapid feature development across 20+ plans:
- Dual TS/JS worker files with **7 behavioral divergences** (bugs waiting to happen)
- 4 unreachable pages, 2 dead files, 7 duplicate type exports (wasted context)
- 5 files >250 lines, inconsistent naming conventions

This debt slows every future change — every payment fix required editing both `payments.ts` AND `payment.js`.

## Scout Summary

| Finding | Severity | Count |
|---------|----------|-------|
| Worker TS/JS divergences | 🔴 Bug-risk | 7 (contact prefix, reviews execCtx, error handler, etc.) |
| Dual middleware with different DB schemas | 🔴 Data-risk | 1 (audit-log: 5 cols vs 13 cols) |
| Unreachable pages | 🟡 Waste | 4 (AboutUs, Contact, BrandGuideline, NotFound) |
| Dead files | 🟡 Waste | 2 (use-track-order.ts, file-allocation-registry.ts) |
| Duplicate type exports | 🟡 Fragility | 7 types across hook/store pairs |
| Files >200 lines | 🟠 Hygiene | 14 files, 5 need splitting |
| Naming inconsistency | 🟠 Hygiene | 2 (stuck-payments-card kebab-case, use-cart-store location) |

## Solution: 3-Bucket Housekeeping Sprint

### Bucket 1: Worker Consolidation → TS Canonical

Delete 5 JS files after resolving all divergences:

| Action | File | Detail |
|--------|------|--------|
| **Resolve** | `index.ts` | 7 divergences: contact prefix strip, reviews execCtx, error handler shape, logger import, changePassword source, payment router, order execCtx |
| **DELETE** | `index.js` | After index.ts verified complete |
| **DELETE** | `payment.js` | `payments.ts` is canonical |
| **DELETE** | `audit-log.js` | After adopting audit-log.ts schema (or vice versa) |
| **DELETE** | `admin-auth.js` | Re-export shim → import `auth.ts` directly |
| **DELETE** | `cors.js` | Re-export shim → import `cors.ts` directly |
| **Update** | Remaining .js routes | Change `./middleware/admin-auth.js` imports → `./middleware/auth` |

### Bucket 2: Dead Code Removal

| Action | File | Detail |
|--------|------|--------|
| **ADD route** | `App.tsx` | `/about` → AboutUs, `/contact` → Contact, `/brand` → BrandGuideline, `*` → NotFound |
| **DELETE** | `use-track-order.ts` | Replaced by useOrderStore in TrackOrder page |
| **DELETE** | `file-allocation-registry.ts` | Build artifact, never imported |
| **DEDUPLICATE** | 7 hook/store pairs | Single source: `MenuItem`, `Order`, `ContactFormData`, `TimeSlot`, `TableInfo`, `ReservationPayload`, `REFERRAL_CASHBACK_VND` |

### Bucket 3: File Hygiene

| Action | File | Lines → Target |
|--------|------|----------------|
| **SPLIT** | `CheckinApprove.tsx` | 315 → extract filter bar + table row |
| **SPLIT** | `loyalty-calculator.tsx` | 290 → extract tier projection + referral calculator |
| **SPLIT** | `TableReservation.tsx` | 287 → extract time slot picker + table map |
| **SPLIT** | `order-success.tsx` | 278 → extract status progress bar + next steps |
| **SPLIT** | `checkout.tsx` | 277 → extract order summary sidebar |
| **RENAME** | `stuck-payments-card.tsx` | → `StuckPaymentsCard.tsx` (PascalCase) |
| **MOVE** | `use-cart-store.ts` | `hooks/` → `hooks/stores/` (follow convention) |

## Impact Assessment

| Metric | Before | After |
|--------|--------|-------|
| Worker source files | 2 index + 5 dual middleware | 1 index (TS canonical) |
| Unreachable pages | 4 | 0 (all routed) |
| Dead files | 2 | 0 |
| Duplicate type exports | 7 | 0 (single source) |
| Files >200 lines | 14 | ~9 (5 split) |
| Naming violations | 2 | 0 |
| Test pass requirement | 510 | 510 (no regression) |

## Non-Negotiables

- All 510 tests keep passing
- Build: 0 errors
- No API contract changes
- No DB schema changes
- TDD: behavioral changes tested first
- No converting .js-only routes to .ts (out of scope)

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Worker deploy breaks after JS deletion | Deploy TS build to preview first, smoke test |
| Route divergence fix breaks contact/reviews | TDD: write test for current behavior before fix |
| File split breaks imports | Use IDE refactor; TypeScript catches broken imports at build |
| audit-log schema divergence causes data loss | Read both schemas, pick superset, write migration if needed |

## Out of Scope

- Converting remaining .js-only routes to TypeScript (~22 files)
- Writing new features
- UI redesign
- Database migrations (except audit-log if needed)
- Test coverage improvements

## Recommended Plan Mode

`/ck:plan --tdd` — consolidating worker files and splitting large components are refactoring operations where existing tests must lock in current behavior before changes.
