# A4: Test Suite Stabilization & E2E Coverage

**Date:** 2026-07-03
**Status:** Planned
**Priority:** P1 High
**Source:** Post-stitch regression risk; existing tests may fail due to CSS/component changes from A1-A3
**Effort:** 4-6 hours
**Dependencies:** A1, A2, A3 (run AFTER all three; tests verify those changes didn't break anything)
**Blocks:** A5 (should run with clean test suite)

---

## 1. Technical Design

### Problem Statement

The project has 1184 tests across 116 test files. Phase A changes (CSS token overhaul, component bg fixes, emoji substitutions) may cause regressions in:
- **Snapshot-style tests** — Components testing rendered HTML may fail if class names change
- **Background color assertions** — Tests asserting specific CSS classes may reference old light-mode tokens
- **Accessibility tests** — aria-label/role changes from emoji migration may trigger failures
- **Rendering tests** — Components expecting emoji text will fail when replaced with SVG icons

Additionally, the current test suite lacks coverage for:
- BroadcastPage channel selection
- CampaignsManager trigger icons
- Menu card with Lucide icons (replacing emoji)
- Responsive layout breakpoints
- Glass-panel accessibility with reduced motion

### Architecture

```
Test Strategy:
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: Baseline validation (before A1-A3 changes)         │
│   npm test → capture 1184/1184 as baseline                  │
├─────────────────────────────────────────────────────────────┤
│ Phase 2: Run after A1 (design token changes)                │
│   Fix CSS class reference tests                             │
├─────────────────────────────────────────────────────────────┤
│ Phase 3: Run after A2 (component bg fixes)                  │
│   Fix bg class assertions                                   │
├─────────────────────────────────────────────────────────────┤
│ Phase 4: Run after A3 (emoji migration)                     │
│   Fix emoji-related assertions                               │
├─────────────────────────────────────────────────────────────┤
│ Phase 5: NEW tests for changed components                   │
│   BroadcastPage, CampaignsManager, menu icon tests           │
├─────────────────────────────────────────────────────────────┤
│ Phase 6: Add E2E coverage gaps                              │
│   Visual regression, responsive, a11y                        │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Fix tests, don't weaken them** — Do not remove assertions; update expected values to match new behavior. If a test asserted `bg-white`, fix it to assert `bg-[var(--aura-bg-elevated)]`.

2. **No test infrastructure changes** — Vitest config is stable (jsdom, @testing-library). No new tooling.

3. **E2E additions target high-risk areas** — Add Playwright tests for the admin pages most affected by Phase A changes.

4. **Parallel execution** — A4 can parallelize across 3 streams: unit fix stream, new unit stream, E2E stream.

---

## 2. File List

### Files Likely Needing Test Fixes (Identify After Running Tests)

| Area | Likely Failure | Fix Strategy |
|------|---------------|-------------|
| `src/components/ui/__tests__/button.test.tsx` | bg class assertion | Update expected class from `bg-primary` to `bg-accent` |
| `src/components/ui/__tests__/modal.test.tsx` | bg class assertion | Update expected `bg-white` to `bg-[var(--aura-bg-elevated)]` |
| `src/components/ui/__tests__/card.test.tsx` | glass-panel class | Verify class still propagated correctly |
| `src/components/ui/__tests__/input.test.tsx` | bg class | Already uses `bg-[var(--aura-bg-input)]` — verify |
| `src/pages/__tests__/checkout-payos.test.tsx` | emoji in rendered text | Expect Lucide SVG instead of emoji text |
| `src/components/menu/__tests__/menu-card.test.tsx` | category icon text | Expect Lucide component instead of emoji string |
| Admin page tests | emoji in rendered output | Expect Lucide icons |

### New Test Files to Create

| File | What It Tests |
|------|---------------|
| `src/pages/admin/__tests__/BroadcastPage.test.tsx` | Channel rendering, Lucide icons, form validation |
| `src/pages/admin/__tests__/CampaignsManager.test.tsx` | Trigger icon rendering, toggle campaigns |
| `src/components/ui/__tests__/badge.test.tsx` | All 5 badge variants render with dark-mode classes |
| `src/components/ui/__tests__/skeleton.test.tsx` | Variants render, aria-hidden present |
| `src/components/order/__tests__/payment-method-selector.test.tsx` | Payment icons render as Lucide |

### E2E Test Files to Create

| File | What It Tests |
|------|---------------|
| `tests/e2e/phase-a-visual-regression.spec.ts` | Screenshot comparisons for Home, Menu, Admin Dashboard, Broadcast |
| `tests/e2e/phase-a-admin-flows.spec.ts` | BroadcastPage form flow, CampaignsManager toggle |
| `tests/e2e/phase-a-a11y.spec.ts` | axe-core scan on key pages (Home, Menu, Admin) |

---

## 3. Database Changes

None.

---

## 4. API Endpoints

None.

---

## 5. Frontend Components

No new production components. New test-only components (test setup helpers, mock providers).

---

## 6. Tests

### Test Categories Breakdown

**Unit Tests to Fix** (estimate 10-15 existing tests)
- `src/components/ui/__tests__/button.test.tsx` — bg color assertions
- `src/components/ui/__tests__/modal.test.tsx` — bg color assertions
- `src/components/ui/__tests__/card.test.tsx` — glass-panel class
- `src/components/ui/__tests__/input.test.tsx` — bg class (verify)
- `src/pages/__tests__/checkout-payos.test.tsx` — emoji text assertions
- Admin page tests — emoji/icon assertions

**New Unit Tests** (12-15 new tests)
- BroadcastPage: render channels, submit validation, preview text
- CampaignsManager: trigger icons, campaign stats rendering
- Badge: all 5 dark variant classes
- Skeleton: 3 variants, aria-hidden
- PaymentMethodSelector: icon rendering

**E2E Tests** (3 new specs, ~30 assertions)
- Visual regression: screenshot snapshots for changed pages
- Admin flows: broadcast send, campaign toggle
- Accessibility: axe-core scans

### Execution Plan

```bash
# Step 1: Run full suite to establish baseline failures
npm test -- --reporter=verbose 2>&1 | grep "FAIL"

# Step 2: Fix failing unit tests
npx vitest run src/components/ui/__tests__/
npx vitest run src/pages/__tests__/

# Step 3: Run full suite again
npm test

# Step 4: Add new unit tests
npx vitest run src/pages/admin/__tests__/BroadcastPage.test.tsx

# Step 5: Run E2E
npx playwright test tests/e2e/phase-a-*.spec.ts
```

---

## 7. Acceptance Criteria

- [ ] `npm test` passes with 1184+ tests (minimum 1184, target 1200+ with new tests)
- [ ] `npm run build` passes with 0 errors
- [ ] All existing tests pass with zero modification to test assertions (only fix expected values)
- [ ] New BroadcastPage unit test covers: renders channels, form validation, preview text
- [ ] New CampaignsManager test covers: renders trigger icons, campaign rendering
- [ ] New Badge test covers: all 5 dark-mode variant classes
- [ ] New Skeleton test covers: text/circular/rectangular variants
- [ ] New PaymentMethodSelector test covers: both payment icons rendered as Lucide
- [ ] E2E: visual regression screenshot tests pass on Home, Menu pages
- [ ] E2E: axe-core scan finds 0 critical/ serious violations on key pages
- [ ] E2E: Broadcast form submit flow works end-to-end
- [ ] No `:any` types in test files

---

## 8. Rollback Plan

### If test fix is incorrect
```bash
# Revert individual test fix
git checkout -- src/components/ui/__tests__/button.test.tsx
```

### If E2E tests are flaky
```bash
# Increase timeouts or skip flaky test
npx playwright test --grep-invert "flaky-test-name"
```

### If build fails from new test imports
```bash
# Remove problematic test files
rm tests/e2e/phase-a-visual-regression.spec.ts
```

### Global rollback
```bash
git checkout HEAD~20 -- src/**/*.test.* src/components/ui/__tests__/ tests/
npm run build
npm test
```

---

## 9. Estimated Effort

| Task | Time |
|------|------|
| Identify and fix all test regressions from A1-A3 | 1.5h |
| Write BroadcastPage unit tests | 45 min |
| Write CampaignsManager unit tests | 30 min |
| Write Badge, Skeleton, Menu icon unit tests | 30 min |
| Write PaymentMethodSelector test | 15 min |
| Write E2E visual regression specs | 45 min |
| Write E2E admin flow specs | 30 min |
| Write E2E a11y scan spec | 20 min |
| Full suite run + fix iteration | 30 min |
| **Total** | **~5-6h** |
