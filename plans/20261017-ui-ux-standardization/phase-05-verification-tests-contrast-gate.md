# Phase 05: Verification — Contrast Check, TypeScript Build & Test Suite

## Context Links
- Overview Plan: [`plans/20261017-ui-ux-standardization/plan.md`](./plan.md)
- Audit Report: [`plans/reports/ui-ux-deep-audit-20261017.md`](../reports/ui-ux-deep-audit-20261017.md)

## Overview
- **Priority:** P0 (Quality Gate)
- **Current Status:** Completed
- **Description:** Update unit tests whose fixtures/assertions still expect `39 Nguyễn Tất Thành`, run the expanded M3 contrast gate (`npm run check:contrast`), run the TypeScript production build (`npm run build`), run the full Vitest suite (`npx vitest run`), and invoke `code-reviewer` to sign off.

## Key Insights
- 8 test files currently assert or use `39 Nguyễn Tất Thành` in fixtures (`StitchAbout.test.tsx`, `our-story.test.tsx`, `contact-new.test.tsx`, `checkout-form.test.tsx`, `stitch-checkout-new.test.tsx`, `use-order-store.test.ts`, `use-checkout.test.ts`, `validators.test.ts`).
- All 3,228+ unit tests and `npm run build` must pass with zero errors.

## Requirements
### Functional Requirements
1. Update test files expecting `39 Nguyễn Tất Thành` to `29 Nguyễn Tất Thành`.
2. Add/update unit tests verifying:
   - M3 dark-theme contrast pairs (11/11 PASS).
   - `DrinkCustomizerModal` state reset on item switch and `role="dialog"` / `Escape` dismissal.
   - Track Order VND price rendering (no `/ 100` bug).
3. Run `npm run check:contrast`, `npm run build`, and `npx vitest run`.

## Related Code Files
- **Files to Modify:**
  - `src/components/stitch/__tests__/StitchAbout.test.tsx`
  - `src/pages/stitch/our-story/__tests__/our-story.test.tsx`
  - `src/pages/stitch/contact-new/__tests__/contact-new.test.tsx`
  - `src/components/order/__tests__/checkout-form.test.tsx`
  - `src/components/stitch/__tests__/stitch-checkout-new.test.tsx`
  - `src/hooks/stores/__tests__/use-order-store.test.ts`
  - `src/hooks/__tests__/use-checkout.test.ts`
  - `src/lib/__tests__/validators.test.ts`
  - `src/components/md3/__tests__/a11y-audit.test.tsx`

## Implementation Steps
1. Update `39 Nguyễn Tất Thành` -> `29 Nguyễn Tất Thành` in the 8 test files.
2. Run `npm run check:contrast` and verify 11/11 PASS.
3. Run `npm run build --silent` and verify 0 TypeScript/Vite errors.
4. Run `npx vitest run --reporter=dot` and verify 100% test pass rate.
5. Run `code-reviewer` subagent to audit the diff.

## Todo List
- [x] Update address assertions in test files (`39` -> `29 Nguyễn Tất Thành`)
- [x] Run `npm run check:contrast` (11/11 PASS)
- [x] Run `npm run build` (0 TS errors)
- [x] Run `npx vitest run` (all tests green)
- [x] Run `code-reviewer` verification

## Success Criteria
- `npm run check:contrast` → 0 failures.
- `npm run build` → exit code 0.
- `npx vitest run` → 0 failed tests.
- `grep -rn "39 Nguyễn Tất Thành\|27 Nguyễn Tất Thành" src/ public/ README.md` → 0 matches.
