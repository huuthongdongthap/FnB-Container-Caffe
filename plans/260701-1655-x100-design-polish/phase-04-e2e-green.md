---
phase: 4
title: "E2E Green"
status: pending
priority: P1
dependencies: []
effort: "1-2h"
---

# Phase 4: E2E Green

## Overview

Fix real E2E test failures. Red-team verified: 31 E2E tests (not 66), across
3 spec files (fnb-audit.spec.ts: 15, ui-audit.spec.ts: 15, debug_errors.spec.ts: 1).
Dependency on Phase 2 removed — `#shared-navbar` was already present on all pages.

## TDD Structure

1. **Capture baseline**: Run `npx playwright test --project="Desktop Chrome" --list` → actual test count. Run full suite → record exact failures.
2. **Fix real failures**: Address only actual failing tests (not assumed failures from brainstorm)
3. **Verify**: All tests pass.

## Issues to Fix

### Cal.com embed error (test-only fix)
**File**: `table-reservation.html:18` loads `https://app.cal.com/embed/embed.js`  
**Problem**: External script fails in test environment. No `Cal('init')` call exists in project code — the error comes from embed.js itself.  
**Fix**: Test-only — configure Playwright to accept third-party script errors as non-fatal, or use `page.route()` to mock the embed script.

```typescript
// In test: accept Cal.com script errors as non-fatal (external dependency)
page.on('console', msg => {
  if (msg.text().includes('Cal') || msg.text().includes('cal.com')) return;
  // fail on other errors
});
```

### FOVT test (check actual assertion)
**File**: `tests/playwright/fnb-audit.spec.ts`  
**Problem**: Test checks `data-theme` attribute presence, not unstyled text flash. May fail on React SPA `/` route because CSS vars load asynchronously.  
**Fix**: Read actual test assertion. If it checks `data-theme`, verify the SPA sets it. If timing issue, adjust wait strategy — not skip.

### brand-tokens.css cross-page check
**File**: `tests/playwright/fnb-audit.spec.ts`  
**Problem**: Test may expect brand-tokens.css on all pages; some pages load homepage-v6.css instead.  
**Fix**: Accept both as valid theme CSS files.

## Implementation Steps

1. **Baseline capture**: `npx playwright test --project="Desktop Chrome" 2>&1 | tail -30` → record exact failures
2. **Read actual tests**: Read `tests/playwright/fnb-audit.spec.ts` (178 lines, loop-based, 15 tests) to understand real assertions
3. **Fix Cal.com**: Add console error filter for third-party Cal.com errors in test
4. **Fix FOVT**: Verify `data-theme` attribute on SPA pages; adjust wait strategy if needed
5. **Fix brand-tokens**: Adjust CSS check to accept homepage-v6.css as valid alternative
6. **Run E2E**: `npx playwright test --project="Desktop Chrome"` → target all pass

## Success Criteria

- [ ] All E2E tests pass (Desktop Chrome) — exact count determined at baseline capture
- [ ] No test hacks — all fixes justified with inline comments
- [ ] No NEW `npm test` failures beyond 60 baseline
- [ ] `npm run build` passes (0 errors)

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Cal.com fix breaks real embed on production | Test-only fix (page.on console filter). No HTML/JS changes needed. |
| FOVT fix masks real CSS loading bugs | Only adjust for SPA route; keep FOVT test for all static HTML pages |
