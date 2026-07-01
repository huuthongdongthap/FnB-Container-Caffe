---
phase: 6
title: "Testing + Polish"
status: complete
priority: P1
effort: "3h"
dependencies: [2, 3, 4, 5]
---

# Phase 6: Testing + Polish

## Overview

Final integration verification: all 268 existing tests still pass, all new store tests pass, end-to-end flows work, build succeeds, no regressions. Polish loading/error/empty states across all pages.

## Requirements

- Functional: All tests pass, build succeeds, manual smoke test of critical flows
- Non-functional: 0 TypeScript errors, 0 console.log in production code, consistent loading/error/empty state patterns

## Related Code Files

- Create: `src/hooks/stores/__tests__/integration-checkout-flow.test.ts`
- All store test files from Phases 1-5
- All page component files from Phases 1-5
- `src/App.tsx` — verify all routes
- `src/test-utils.tsx` — verify AuthProvider works in tests

## Implementation Steps

### Gate 1: Full Test Suite

1. Run `npx vitest run` — verify ALL tests pass (268 existing + all new store/component tests)
2. If any existing test fails: debug + fix. Do NOT skip or mock around failures
3. Expected: 420+ tests passing (268 existing + ~150 new)
4. **Integration test**: Full checkout flow — menu.fetch → cart.add → order.create → payment.createLink. Mock API responses. Verify store state transitions through complete revenue path.

### Gate 2: TypeScript + Build

4. Run `npx tsc --noEmit` — must return 0 errors
5. Run `npm run build` — must succeed, 0 warnings about missing exports
6. Check build output for bundle size regression (baseline: 563KB JS + 103KB CSS)

### Gate 3: Lint + Code Quality

7. Run `npm run lint` — fix any new errors introduced
8. Verify no `console.log` in production source (components/stores/hooks)
9. Verify no `:any` types in new code
10. Verify all Zustand stores follow the same pattern (matching `use-cart-store.ts`)

### Gate 4: Smoke Test Critical Flows

11. **Auth flow**: Register → Login → see dashboard → logout → redirected to login
12. **Order flow**: Browse menu → add to cart → checkout (COD) → order success page
13. **Payment flow**: Browse menu → add to cart → checkout (PayOS) → payment link generated
14. **Loyalty flow**: Login → visit loyalty page → see tier + points
15. **Admin flow**: Login as owner → dashboard stats load → manage orders → manage staff

### Gate 5: UI State Audit

16. Verify EVERY page has:
    - Loading state (skeleton/spinner) while API call in progress
    - Error state (message + retry button) on API failure
    - Empty state (friendly message) when data is empty
17. Verify responsive behavior: test at 375px, 768px, 1440px
18. Verify keyboard navigation: tab order, focus styles, Escape to close modals

### Gate 6: Final Verification

19. Run full test suite one final time
20. Run `npm run build` one final time
21. Deploy to Cloudflare Pages preview (`npx wrangler pages deploy dist --project-name=fnb-caffe-container`)
22. Verify deployed site loads JS/CSS correctly (application/javascript, not text/html)
23. Verify SPA routing works on deployed preview (/, /menu, /checkout all return index.html for client routing)
24. Smoke test 2-3 critical flows on deployed preview

## Success Criteria

- [ ] ALL tests pass (268 existing + ~130 new = 400+ total)
- [ ] `npm run build` — 0 TypeScript errors, 0 warnings
- [ ] `npm run lint` — no new errors
- [ ] Zero `console.log` in production code
- [ ] Zero `:any` types in new code
- [ ] All pages have loading/error/empty states
- [ ] 5 critical flows smoke-tested on deployed preview
- [ ] Deployed site JS/CSS served with correct MIME types
- [ ] No regression in bundle size (>20% increase requires investigation)
- [ ] All Zustand stores follow consistent pattern (matching `use-cart-store.ts`)
