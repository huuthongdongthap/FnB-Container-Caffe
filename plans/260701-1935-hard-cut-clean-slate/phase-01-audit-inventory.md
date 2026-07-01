---
phase: 1
title: "Audit & Inventory"
status: pending
priority: P1
dependencies: []
effort: 2-3h
---

# Phase 1: Audit & Inventory

## Overview

Verify 100% React SPA ↔ static HTML page parity, map every CSS/JS file to its consumers, capture test/build baselines. No code changes — read-only audit.

## TDD Structure

```
Step A: Capture baseline tests      → npm test (capture 60 failures)
Step B: Capture baseline E2E        → npx playwright test (capture 28 failures)
Step C: Verify page parity          → cross-reference SPA routes vs static HTML
Step D: Map file dependencies       → which files loaded by whom
Step E: Regression Gate             → verify baselines unchanged after audit
```

## Requirements

- Functional: Confirm every static HTML page has a working React SPA route
- Functional: Map all 32 CSS + 35 JS files to consumers (static-only, SPA-only, shared)
- Functional: Capture exact test failure counts and error types
- Non-functional: Document all `_redirects` rules and their SPA route targets

## Architecture

```
Audit (read-only)
├── Scout HTML inventory     → 52 static HTML files mapped
├── Scout CSS usage          → 48 CSS files = static-only, 0 = SPA
├── Scout JS usage           → 35 JS files = static-only, 0 = SPA
├── SPA route verification   → 27 React pages vs 30+ static pages
├── Test baseline capture    → 60 unit failures, 28 E2E failures
├── Build baseline           → 0 TypeScript errors
└── _redirects audit         → 4 legacy .html rules, need wildcard
```

## Related Code Files

- Modify: `_redirects` (add wildcard rule later in Phase 2)
- Read-only: all `css/*.css`, `js/*.js`, `*.html`, `admin/*.html`, `signage-widgets/*.html`

## Implementation Steps

### Step A: Capture Baseline Tests
1. Run `npm test 2>&1 | tail -20` — capture exact failure count and error patterns
2. Save output to `plans/260701-1935-hard-cut-clean-slate/audit/baseline-unit-tests.txt`
3. Categorize failures: Jest→Vitest migration candidates vs actual bugs

### Step B: Capture Baseline E2E
1. Run `npx playwright test 2>&1 | tail -20` — capture exact failure count
2. Save output to `plans/260701-1935-hard-cut-clean-slate/audit/baseline-e2e.txt`
3. Identify which failures are static-HTML-related (will auto-resolve after Phase 2)

### Step C: Verify Page Parity
1. Extract all React SPA routes from `src/App.tsx` or router config
2. Cross-reference against static HTML page list:
   - Root: 20 static HTML files (excl. `index.html` Vite entry)
   - Admin: 9 static HTML files
   - Signage: 3 static HTML files
3. Mark each: ✅ SPA route exists / ⚠️ needs verification / ❌ missing
4. Output parity matrix to `plans/260701-1935-hard-cut-clean-slate/audit/page-parity.md`

### Step D: Map File Dependencies
1. For each CSS file in `css/`: grep all HTML files for references
2. For each JS file in `js/`: grep all HTML files for `<script src=`
3. Mark: "static-only" (safe to delete), "SPA-only" (keep), "shared" (investigate)
4. Output dependency map to `plans/260701-1935-hard-cut-clean-slate/audit/file-deps.md`

### Step E: `_redirects` Audit
1. List every `.html` URL in `_redirects`
2. Verify SPA route exists at target
3. Identify missing redirects (legacy URLs without rules)
4. Output redirect map to `plans/260701-1935-hard-cut-clean-slate/audit/redirects-audit.md`

### Step F: Regression Gate
1. Re-run `npm test` — confirm same 60 failures (no new failures)
2. Re-run `npx playwright test` — confirm same 28 failures
3. Run `npm run build` — confirm 0 TypeScript errors
4. Verify audit reports are complete and accurate

## File Inventory

| Category | Count | Files |
|----------|-------|-------|
| Root static HTML | 20 | about-us, brand-guideline, checkin, checkout, contact, events, failure, index-legacy, kds, loyalty, loyalty-calculator, menu, promotions, receipt-template, referral, success, table-reservation, track-order, tv-menu, 404 |
| Admin static HTML | 9 | checkin-approve, customers, dashboard, erpnext-sync, login, orders, pos, reservations, staff |
| Signage static HTML | 3 | menu-board, promo-screen, welcome-screen |
| Other locations | 20 | signup/index.html, public/offline.html, tools/bazi-mcp/*.html, assets/**/*.html, reports/*.html |
| CSS in `css/` | 32 | homepage-v6 (4568 lines), brand-tokens, menu-v6, ... |
| JS in `js/` | 35 | loyalty, menu, checkout, kds-app, ... |
| Vite entry (KEEP) | 1 | index.html |

## Test Scenario Matrix

| Test Suite | Files | Tests | Status |
|------------|-------|-------|--------|
| Vitest (React components) | 58 | 418 | 417 pass, 1 fail |
| Jest (worker modules) | 29 | 646 | 586 pass, 60 fail |
| Playwright E2E Desktop Chrome | 2 specs | 151 | ~123 pass, 28 fail |

## Success Criteria

- [ ] Page parity matrix complete: every static HTML → React SPA route verified
- [ ] File dependency map complete: every CSS/JS file classified
- [ ] `_redirects` audit complete: all legacy URLs mapped to SPA routes
- [ ] Baseline tests captured: exact failure counts documented
- [ ] Build baseline: 0 TypeScript errors confirmed
- [ ] All audit reports saved to `plans/260701-1935-hard-cut-clean-slate/audit/`

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| SPA missing a route that static HTML serves | Document gap, flag for Phase 2 before deleting corresponding .html |
| Some CSS/JS shared between static and SPA | `brand-tokens.css` is referenced by static HTML; check if SPA bundles equivalent |
| `public/offline.html` needed for PWA | Check service worker config before deleting |
