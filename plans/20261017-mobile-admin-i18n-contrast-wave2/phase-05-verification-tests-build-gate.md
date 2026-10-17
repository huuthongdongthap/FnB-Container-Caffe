# Phase 05: Full Verification, Contrast Gate, Typecheck & Build

## Context Links
- Overview Plan: `plans/20261017-mobile-admin-i18n-contrast-wave2/plan.md`

## Overview
- **Priority**: P0 (Mandatory Release Gate)
- **Current Status**: Pending
- **Description**: Validate all Phase 01–04 changes against WCAG 2.1 AA contrast checks, TypeScript compiler (frontend + worker), ESLint, Vitest unit/integration suite, and Vite production build.

## Implementation Steps
1. Run `npm run check:contrast` to verify 11/11 WCAG 2.1 AA token contrast pairs pass.
2. Run `npx tsc --noEmit` and `npx tsc -p worker/tsconfig.json --noEmit` to verify zero TypeScript errors.
3. Run `npm run lint --silent` to verify zero ESLint errors in `worker/src/`.
4. Run `npx vitest run` across all test files and update any outdated test assertions (such as legacy dummy addresses or phone numbers in `StitchFooter.test.tsx`, `StitchContactNew.test.tsx`, `StitchOrderSuccessNew.test.tsx`, `StitchLandingNew.test.tsx`).
5. Run `npm run build` to verify clean production bundle output.

## Todo List
- [ ] `npm run check:contrast` (11/11 PASS)
- [ ] `npx tsc --noEmit` & `npx tsc -p worker/tsconfig.json --noEmit` (0 errors)
- [ ] `npm run lint --silent` (0 errors)
- [ ] `npx vitest run` (100% test files pass)
- [ ] `npm run build` (0 build errors)
