---
phase: 4
title: "Fix Tests → Green CI"
status: pending
priority: P1
dependencies: [3]
effort: 8-12h
---

# Phase 4: Fix Tests → Green CI

## Overview

Fix 60 unit test failures (Jest→Vitest migration) + 28 E2E failures (static HTML cleanup). Target: 646/646 unit tests pass, 151/151 E2E pass. Migrate Jest tests to Vitest (unified test runner), delete Jest config.

## TDD Structure

```
Step A: Capture exact failures         → detailed failure inventory
Step B: Migrate Jest→Vitest setup      → vitest config + setup files
Step C: Convert test files             → 29 test files: jest.fn→vi.fn, require→import
Step D: Fix remaining unit failures    → any non-Jest-related test bugs
Step E: Fix E2E tests                  → update page list, fix selectors
Step F: Regression Gate                → 100% green: 0 unit + 0 E2E failures
```

## Requirements

- Functional: All 646 unit tests pass (0 failures)
- Functional: All 151 E2E tests pass (0 failures)
- Functional: Single test runner (Vitest only, Jest deleted)
- Functional: `npm test` exits 0
- Functional: `npx playwright test` exits 0
- Non-functional: Test coverage maintained or improved

## Architecture

```
Test Migration Strategy

Jest tests (29 files, tests/)
├── Step 1: Create tests/vitest-setup.ts
│   ├── vi.mock() for worker/src/utils/logger.js (breaks TS import chain)
│   ├── Polyfills: TextEncoder, TextDecoder, IntersectionObserver
│   └── Global mocks: fetch, WebSocket
├── Step 2: Convert test files (mechanical)
│   ├── jest.fn() → vi.fn()
│   ├── jest.mock() → vi.mock()
│   ├── require() → import
│   └── @jest/globals → vitest
├── Step 3: Update vitest.config.ts
│   ├── include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{js,ts}']
│   └── setupFiles: ['src/test-setup.ts', 'tests/vitest-setup.ts']
└── Step 4: Delete Jest
    ├── npm uninstall jest @types/jest jest-environment-jsdom babel-jest
    └── rm jest.config.cjs babel.config.js

E2E Fixes (2 spec files, tests/playwright/)
├── Remove deleted static pages from PAGES array
│   ├── ui-audit.spec.ts: remove .html URLs, use SPA routes
│   └── fnb-audit.spec.ts: remove .html URLs, use SPA routes
├── Fix brand-tokens.css check → SPA bundles CSS, not linked
├── Fix emoji checks → admin pages have decorative emoji
└── Fix FOVT timing → SPA hydration delay
```

## Related Code Files

- Create: `tests/vitest-setup.ts` (worker test polyfills + mocks)
- Modify: `vitest.config.ts` (add `tests/**` to include, add setup file)
- Modify: `tests/**/*.test.js` → `tests/**/*.test.ts` (29 files, Jest→Vitest conversion)
- Modify: `tests/playwright/ui-audit.spec.ts` (update PAGES, fix checks)
- Modify: `tests/playwright/fnb-audit.spec.ts` (update PAGES, fix checks)
- Delete: `jest.config.cjs`
- Delete: `babel.config.js` (if only used for Jest)
- Modify: `package.json` (update test scripts, remove jest deps)

## Implementation Steps

### Step A: Capture Exact Failures
1. Run `npm test 2>&1 | grep -E '(FAIL|PASS|Tests:|Test Suites:)'` — capture full output
2. Categorize failures:
   - Type A: Jest CJS cannot parse TS `export` (logger.ts chain) — ~45 failures
   - Type B: `jest.fn` / `jest.mock` in files that will convert to `vi.fn` / `vi.mock` — ~10 failures
   - Type C: Actual test bugs (assertion logic) — ~5 failures
3. Run `npx playwright test 2>&1 | grep -E '(\d+ failed|\d+ passed)'` — capture exact counts
4. Save to `plans/260701-1935-hard-cut-clean-slate/audit/failure-inventory.md`

### Step B: Migrate Jest → Vitest Setup
1. Create `tests/vitest-setup.ts`:
   ```ts
   import { vi } from 'vitest';
   import { TextEncoder, TextDecoder } from 'util';

   // Worker polyfills
   globalThis.TextEncoder = TextEncoder as typeof globalThis.TextEncoder;
   globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;

   // Mock the TypeScript logger — breaks the import chain
   vi.mock('../worker/src/utils/logger.js', () => ({
     createLogger: vi.fn(() => ({
       debug: vi.fn(), info: vi.fn(), warn: vi.fn(),
       error: vi.fn(), child: vi.fn(),
     })),
     newRequestId: vi.fn(() => 'r_test_' + Date.now().toString(36)),
   }));

   // Browser globals for jsdom
   globalThis.IntersectionObserver = class {
     observe() {}; unobserve() {}; disconnect() {};
   } as any;
   ```
2. Update `vitest.config.ts`:
   ```ts
   test: {
     globals: true,
     environment: 'jsdom',
     setupFiles: ['./src/test-setup.ts', './tests/vitest-setup.ts'],
     include: [
       'src/**/*.test.{ts,tsx}',
       'tests/**/*.test.{js,ts}',  // ADD this
     ],
     css: true,
   },
   ```

### Step C: Convert Test Files (29 files)
Priority order (simplest first, builds confidence):
1. **Batch 1** (simplest mock patterns — 5 files):
   - `speedsms-client.test.js`, `resend-client.test.js`, `email.test.js`
   - `erpnext-client.test.js`, `pretix-bridge.test.js`
2. **Batch 2** (complex mocks — 8 files):
   - `mautic-client.test.js`, `mautic-bridge.test.js`, `mixpost-bridge.test.js`
   - `cal-booking-webhook.test.js`, `signage-api.test.js`
   - `erpnext-customers.test.js`, `erpnext-orders.test.js`, `erpnext-products.test.js`
3. **Batch 3** (special patterns — 3 files):
   - `signage-widgets.test.js` (direct jsdom usage)
   - `webhook-security.test.js`, `auth-middleware.test.js`
4. **Batch 4** (remaining — 13 files):
   - All other test files in `tests/`

**Conversion pattern (mechanical — apply to each file):**
```
BEFORE:                               AFTER:
const { test, expect } = require      import { describe, test, expect,
  ('@jest/globals');                    vi, beforeEach, afterEach }
                                        from 'vitest';
const { sendEmail } = require         import { sendEmail }
  ('../worker/src/lib/email.js');       from '../worker/src/lib/email.js';
global.fetch = jest.fn();             beforeEach(() => {
                                        globalThis.fetch = vi.fn();
                                      });
jest.mock('../worker/src/utils/       // REMOVE — now in vitest-setup.ts
  logger.js', () => ({...}));
```

**Per-batch verification:** Run `npx vitest run tests/<converted-file>.test.ts` after each file.

### Step D: Fix Remaining Unit Failures (Type C)
1. Identify tests that fail due to actual bugs (not Jest/Vitest differences)
2. The 1 Vitest failure (`time-slot-picker`): fix assertion logic
3. Any worker test failures after migration: debug and fix
4. Run `npx vitest run` after each fix

### Step E: Fix E2E Tests
1. **Update PAGES arrays** in both spec files:
   - Remove `.html` suffix from all URLs:
     ```js
     // BEFORE:
     { name: 'Menu', url: '/menu.html', checks: [...] }
     // AFTER:
     { name: 'Menu', url: '/menu', checks: [...] }
     ```
   - Remove pages that no longer exist as separate routes (if SPA handles differently)
2. **Update `debug_errors.spec.ts`** (3rd E2E spec — also references .html URLs):
   ```js
   // Same .html → clean URL conversion as ui-audit and fnb-audit
   { name: 'menu', url: '/menu' },
   { name: 'checkout', url: '/checkout' },
   // etc.
   ```
3. **Fix brand-tokens.css check:**
   ```js
   // BEFORE:
   const css = page.locator('link[href*="brand-tokens.css"], link[href*="homepage-v6.css"]');
   // AFTER (SPA bundles CSS, no <link> tags):
   // Either remove this check or verify CSS variables are present:
   const hasVars = await page.evaluate(() => {
     const styles = getComputedStyle(document.documentElement);
     return styles.getPropertyValue('--aura-noir-deep') !== '';
   });
   expect(hasVars).toBe(true);
   ```
3. **Fix emoji checks:**
   - Admin pages use decorative emoji intentionally. Relax regex or exclude admin pages from emoji check.
4. **Fix FOVT timing:**
   - SPA hydration takes longer than static HTML. Increase timeout or wait for specific element.
5. **Fix nav links test:**
   - SPA navigation uses client-side routing. Update locator to find React Router links.
6. **Run after each fix:** `npx playwright test --grep "<test name>"`

### Step F: Delete Jest
1. `npm uninstall jest @types/jest jest-environment-jsdom babel-jest`
2. `rm jest.config.cjs babel.config.js` (if babel.config.js only for Jest)
3. Update `package.json`:
   ```json
   "scripts": {
     "test": "vitest run",
     "test:watch": "vitest",
     "test:coverage": "vitest run --coverage"
   }
   ```

### Step G: Regression Gate
1. `npm test` → 0 failures (646/646 pass)
2. `npx playwright test` → 0 failures (151/151 pass)
3. `npm run build` → 0 TypeScript errors
4. `npm run lint` → 0 errors
5. Test coverage report: compare with Phase 1 baseline

## Test Scenario Matrix

| Category | Before | After |
|----------|--------|-------|
| Vitest (React) | 417/418 pass | 418/418 pass |
| Vitest (ex-Jest worker) | 586/646 pass | 646/646 pass |
| Playwright E2E | ~123/151 pass | 151/151 pass |
| Test runners | 2 (Vitest + Jest) | 1 (Vitest only) |
| `npm test` exit code | 1 (failures) | 0 |

## Success Criteria

- [ ] `npm test` → 646/646 pass, exit 0
- [ ] `npx playwright test` → 151/151 pass, exit 0
- [ ] Jest fully removed from project
- [ ] Single test runner (Vitest)
- [ ] `npm run build` → 0 errors
- [ ] `npm run lint` → 0 errors
- [ ] Test coverage ≥ Phase 1 baseline

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| `vi.mock()` doesn't break TS import chain | Mock placed in vitest-setup.ts (runs before any test). If fails, mock at file level |
| Some tests fundamentally depend on Jest APIs | `jest.setTimeout` → `test.setTimeout`. `jest.useFakeTimers` → `vi.useFakeTimers` (API compatible) |
| E2E tests break after page URL changes | Update PAGES array. New 404 → add SPA route if missing. Remove test if page intentionally deleted |
| Test coverage drops from Jest→Vitest change | Coverage reporters are compatible. Verify with `vitest run --coverage` |
| SPA hydration causes timing flakiness | Add `waitForSelector` or `waitForLoadState('networkidle')` before assertions |
