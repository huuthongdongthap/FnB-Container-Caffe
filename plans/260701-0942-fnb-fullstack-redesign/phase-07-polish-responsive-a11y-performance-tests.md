---
phase: 7
title: "Polish + Atomic Deploy: Responsive/A11y/Performance/Tests/CSP/Rollback"
status: pending
priority: P1
dependencies: [2, 3, 4, 5, 6]
effort: "13h"
---

# Phase 7: Polish + Atomic Deploy

## Overview

Cross-cutting quality pass across all migrated pages and backend routes. This is the ONLY deployment phase — all previous phases BUILD but do NOT deploy. Single atomic cutover from static HTML to React SPA.

**Red-team corrections:** Added CSP audit (critical), rollback verification (critical), atomic deploy strategy (replaces per-phase deploys). Dropped: code splitting, service worker, design-token snapshot tests. Added: Playwright E2E tests (installed in Phase 1).

## Architecture

No new components. Audit → fix → verify across entire codebase, then single atomic deploy.

```
Checklist per page:
├── Responsive: 375px / 768px / 1024px / 1440px
├── Accessibility: axe-core scan, keyboard nav, screen reader
├── Performance: Lighthouse ≥ 90, Core Web Vitals
├── Visual: matches design tokens, font stack correct (Cormorant Garamond)
├── Functional: all user flows work end-to-end
├── CSP: new origins whitelisted, React scripts load, Cal.com iframe works
└── Rollback: previous deployment IDs recorded, smoke tests defined
```

## TDD: Tests to Write First

1. `tests/e2e/home.spec.ts` — loads home, hero renders, menu link navigates, 5 zones visible
2. `tests/e2e/checkout-flow.spec.ts` — menu → add to cart → checkout → fill form → submit → success
3. `tests/e2e/loyalty-flow.spec.ts` — view tier → check points → redeem reward → confirmation
4. `tests/e2e/admin-flow.spec.ts` — login → dashboard stats → order list → filter by status
5. `tests/e2e/responsive.spec.ts` — viewport 375/768/1024/1440 for 5 critical pages, no horizontal scroll
6. `tests/a11y/accessibility.test.ts` — axe-core scan on all pages, 0 violations (WCAG AA)
7. `tests/perf/performance.test.ts` — Lighthouse CI: perf ≥ 90, a11y ≥ 95, seo ≥ 90
8. `tests/integration/api-contract.test.ts` — worker API responses match TypeScript types, all endpoints return expected shapes
9. `tests/regression/existing-behaviors.test.ts` — run adapted 814-test suite, verify all pass
10. `tests/deploy/smoke.test.ts` — post-deploy: GET /api/menu 200, POST /api/orders 200, GET / 200, PayOS return URL redirect works

## Implementation Steps

### 7.1 Responsive Audit
- Test every page at 375px (mobile), 768px (tablet), 1024px (laptop), 1440px (desktop)
- Fix: horizontal scroll, overlapping text, unreadable font sizes
- Verify: mobile drawer nav, touch targets ≥ 44px
- Verify: `font-display: swap` on all @font-face rules (local woff2 files)

### 7.2 Accessibility Audit
- Run axe-core on every page (automated CI check)
- Keyboard navigation: Tab through all interactive elements, focus rings visible
- Screen reader: test critical flows with VoiceOver
- Verify: all images have alt text, form inputs have labels, landmark regions
- Verify: `prefers-reduced-motion` respected (disable animations AND KDS sound)
- Verify: color contrast ≥ 4.5:1 for text, ≥ 3:1 for large text

### 7.3 CSP Audit (CRITICAL — blocks production)
- Read existing CSP in `_headers:15-16`
- Add new origins required by React app:
  - `script-src`: add any new CDN origins for bundled scripts
  - `frame-src`: add `https://app.cal.com https://cal.com` for Cal.com embed
  - `connect-src`: verify worker origin + PayOS API origin present
- Test: deploy to preview, verify no CSP violations in browser console
- **Without this step, React app loads blank white page in production.**

### 7.4 Performance Optimization
- Lighthouse audit on all pages
- Font optimization: subset Vietnamese + Latin for local woff2 files
- Image optimization: WebP format, srcset, lazy loading (already present on most images)
- Bundle analysis: tree-shake unused CSS
- **Skip:** code splitting (20 pages × 100-700 lines = bundle < 200KB), service worker (Cloudflare CDN already caches)

### 7.5 Test Coverage Push
- Run `npm run test:coverage`, identify uncovered lines
- Add unit tests for edge cases (empty states, error states, loading states)
- Add integration tests for all API endpoints
- Add E2E tests for 5 critical user flows (Playwright)
- Target: ≥ 80% line coverage, ≥ 75% branch coverage

### 7.6 Atomic Deploy + Rollback
- **Record current deployment IDs:** `wrangler pages deployment list` + `wrangler deployments list`
- Deploy React SPA: `wrangler pages deploy dist/`
- Deploy worker: `wrangler deploy` (from staging, promote to production)
- **Immediate smoke tests:** GET /api/menu, POST /api/orders (test), GET /, GET /checkout.html (redirect→200), PayOS sandbox return URL
- **If any smoke test fails:** `wrangler pages deployment rollback` + `wrangler rollback`
- Add `_redirects` rule: `/*.html → /:splat` for graceful old→new URL migration
- Apply D1 migrations if any: `bash scripts/apply-migrations.sh`
- Verify SHA match: `curl /api/version` shortSha matches `git rev-parse HEAD`

### 7.7 Documentation
- Update `README.md` with new React dev setup
- Update `TECH_STACK.md` with framework migration notes
- Archive old static site to `archive/v2.1.0-static/`
- Document rollback procedure in `docs/deployment-guide.md`

## Success Criteria

- [ ] All 10 TDD test files written and passing
- [ ] Responsive: 0 layout issues at all 4 breakpoints
- [ ] Accessibility: 0 axe-core violations, keyboard nav complete, screen reader functional
- [ ] Performance: Lighthouse ≥ 90 on all critical pages
- [ ] **CSP: React app loads without violations; Cal.com iframe functional; scripts/styles not blocked**
- [ ] Coverage: ≥ 80% line, ≥ 75% branch
- [ ] Build: 0 TypeScript errors, 0 lint errors, 0 test failures (814 tests pass)
- [ ] Deploy: Atomic cutover succeeds; all smoke tests pass
- [ ] Rollback: Previous deployment IDs recorded; rollback tested and documented
- [ ] checkout.html → /checkout redirect functional
- [ ] Old static site archived; `/*.html → /:splat` redirect in place
- [ ] All 12 acceptance criteria from plan.md met

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| CSP blocks React in production | Audit + test in Phase 7 before deploy; preview environment verification |
| Deploy fails mid-cutover | Rollback IDs recorded; `wrangler rollback` reverts in < 1 min |
| Lighthouse score blocked by third-party embeds | Lazy-load embeds on interaction; measure without them |
| E2E tests flaky in CI | Retry × 2; `playwright --trace on` for debugging |
| Worker D1 bindings differ staging vs production | Same database ID, different env prefix; verify before promote |
