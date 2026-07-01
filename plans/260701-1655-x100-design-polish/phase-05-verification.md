---
phase: 5
title: "Verification"
status: pending
priority: P1
dependencies: [1, 2, 3, 4]
effort: "1-2h"
---

# Phase 5: Verification

## Overview

Full verification sweep: tests pass (no NEW failures beyond 60 baseline), design
audit re-scored, build clean. Confirm zero regressions on AURA CAFE protected flows.

## Requirements

- Functional: E2E all pass. No NEW unit test failures. Build 0 errors.
- Non-functional: Design audit grade improved. AURA CAFE flows intact.

## Verified Baselines (2026-07-01)

- `!important`: 212 (target <80)
- E2E tests: 31 total
- Unit tests: 560 total, 60 pre-existing failures, 14 failed suites
- `<main>` missing: 13 pages

## Verification Gates

### Gate 1: Unit Tests
```bash
npm test 2>&1 | tail -20
```
- [ ] Still 560 total, 586 passed
- [ ] No NEW failures (must still be exactly 60 pre-existing)
- [ ] Same 14 failed suites (no new suites failing)

### Gate 2: Build
```bash
npm run build
```
- [ ] 0 TypeScript errors
- [ ] ESLint passes (build script: `npm run lint && vite build`)
- [ ] Build output complete

### Gate 3: E2E — Desktop Chrome
```bash
npx playwright test --project="Desktop Chrome"
```
- [ ] All tests pass (exact count from Phase 4 baseline)
- [ ] No overflow on any page at any breakpoint
- [ ] No console errors on any page (except Cal.com third-party)
- [ ] Shared-nav renders on all pages

### Gate 4: E2E — Mobile Safari
```bash
npx playwright test --project="Mobile Safari"
```
- [ ] All tests pass (if WebKit available; document limitation if not)

### Gate 5: Design Audit Re-Score
- [ ] CSS files graded F: 9 → 0
- [ ] HTML pages graded F: 8 → 0
- [ ] `!important` count: <80 (from 212 baseline)
- [ ] Dead CSS links: 0 (verify with DevTools Network tab)
- [ ] Overall grade: B+ or higher (was C−)

### Gate 6: AURA CAFE Protected Flows
- [ ] **Checkout**: Add to cart → fill form → submit order → order confirmation
- [ ] **Loyalty**: Check-in → earn points → redeem cashback (no prompt() calls)
- [ ] **Reservation**: Select table → fill identity modal → confirm booking
- [ ] **KDS**: Kitchen display receives and updates orders
- [ ] **POS**: Point-of-sale transaction submission

### Gate 7: Visual Regression
- [ ] Home page `/` renders correctly at mobile (375px), tablet (768px), desktop (1440px)
- [ ] Menu, Checkout, Loyalty, Reservation, Contact, About — all render without overflow
- [ ] No layout shifts on page load (CLS check)

## Implementation Steps

1. Run Gates 1-2: unit tests + build
2. Run Gates 3-4: E2E full suite
3. Run Gate 5: Manual re-score using deep-design-audit methodology
4. Run Gate 6: Manual walkthrough of AURA CAFE protected flows
5. Run Gate 7: Visual inspection at 3 breakpoints

## Success Criteria

- [ ] All 7 gates pass
- [ ] Report generated with before/after metrics
- [ ] Any gate failures documented with root cause and fix plan

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| 60 pre-existing failures mask new regressions | Capture exact failure list before starting; diff after |
| WebKit browser unavailable | Document as limitation; Desktop Chrome is primary target |
| Design rescore subjective | Use same grep-based methodology as original audit |
