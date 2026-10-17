# Phase 02: M3 Dark Tokens, CSS Architecture & Contrast Gate

## Context Links
- Audit Report: [`plans/reports/ui-ux-deep-audit-20261017.md`](../reports/ui-ux-deep-audit-20261017.md)
- Rules: `.claude/rules/m3-strict.md`

## Overview
- **Priority:** P0/P1 (Design System Integrity & WCAG AA Contrast)
- **Current Status:** Completed
- **Description:** Fix inverted dark-theme M3 color tokens in `src/styles/aura-tokens.css`, define missing `--aura-*` CSS variables referenced in `global.css` and UI primitives, resolve runtime font override in `brand-theme.ts`, replace banned Gold/Amber hex and light-mode `bg-white` cards in dark admin views, and expand `scripts/contrast-check.mjs` to cover all 11 M3 token pairs.

## Key Insights
- `src/styles/aura-tokens.css:115-128` defines `--md-sys-color-background: var(--aura-pearl-50)` (`#FAFAF8` light) against `--md-sys-color-on-background: #F5F5F5` (1.04:1 FAIL), `--md-sys-color-surface-variant: var(--aura-chrome-100)` (`#E8ECEF` light) against `on-surface-variant: #C9D6DF` (1.19:1 FAIL), and `--md-sys-color-inverse-surface: var(--aura-noir-void)` (`#050814` dark) against `inverse-on-surface: #0A1A2E` (1.13:1 FAIL, breaking `MD3Snackbar`).
- `src/styles/global.css` and `src/components/ui/drawer.tsx` reference undefined CSS custom properties (`--aura-on-primary`, `--aura-radius-{sm,md,lg,xl,2xl}`, `--aura-duration-fast`, `--aura-glass-blur`, `--aura-glass-border`, `--aura-bg-elevated`, `--aura-bg-high`, `--aura-shadow-lg`).
- `src/config/brand-theme.ts:16` overwrites `--aura-font-display` (`Quicksand`) with `'Be Vietnam Pro'` at runtime.
- Banned Gold/Amber hex (`#D4AF37`, `#FFD700`, `#FFA500`) remain in `TableReservation.tsx:78,224`, `CustomerDisplay.tsx:87`, `PointsToast.tsx:58`, `OrderSuccess.tsx:22`, `RecommendationCarousel.tsx:86`.

## Requirements
### Functional Requirements
1. Fix dark-theme M3 token pairs in `src/styles/aura-tokens.css:115-128`:
   - `--md-sys-color-background`: `var(--aura-noir-900)` (`#0A1A2E`) with `--md-sys-color-on-background`: `var(--aura-pearl-100)` (`#F5F5F5`).
   - `--md-sys-color-surface-variant`: `var(--aura-noir-700)` (`#162F4D`) with `--md-sys-color-on-surface-variant`: `var(--aura-chrome-200)` (`#C9D6DF`).
   - `--md-sys-color-inverse-surface`: `var(--aura-pearl-100)` (`#F5F5F5`) with `--md-sys-color-inverse-on-surface`: `var(--aura-noir-900)` (`#0A1A2E`).
2. Define all missing `--aura-*` alias tokens in `src/styles/aura-tokens.css` so `global.css`, `drawer.tsx`, and `SkeletonAdapter.tsx` resolve cleanly.
3. Update `scripts/contrast-check.mjs` to validate all 11 M3 surface/text pairs (adding `background/on-background`, `surface-variant/on-surface-variant`, `inverse-surface/inverse-on-surface`).
4. Replace banned Gold/Amber hex (`#D4AF37`, `#FFD700`) with M3 chrome/primary tokens (`var(--aura-chrome-mid)`, `var(--md-sys-color-primary)`) and replace `bg-white border-gray-200` in `Analytics.tsx:244` and `Bookings-calendar-view.tsx:84` with dark M3 surface container classes.

### Non-Functional Requirements
- `npm run check:contrast` must pass 11/11 pairs with ratio >= 4.5:1.

## Architecture
- `src/styles/aura-tokens.css` is the single canonical token definition file; `src/styles/global.css` bridges those tokens to Tailwind v4 `@theme`.

## Related Code Files
- **Files to Modify:**
  - `src/styles/aura-tokens.css`
  - `src/styles/global.css`
  - `src/styles/brand-tokens.css`
  - `src/config/brand-theme.ts`
  - `scripts/contrast-check.mjs`
  - `src/components/ui/drawer.tsx`
  - `src/components/ui/adapters/SkeletonAdapter.tsx`
  - `src/components/loyalty/PointsToast.tsx`
  - `src/components/menu/RecommendationCarousel.tsx`
  - `src/pages/TableReservation.tsx`
  - `src/pages/CustomerDisplay.tsx`
  - `src/pages/OrderSuccess.tsx`
  - `src/pages/admin/Analytics.tsx`
  - `src/pages/admin/Bookings-calendar-view.tsx`
- **Files to Create:** None
- **Files to Delete:** None

## Implementation Steps
1. Edit `src/styles/aura-tokens.css`:
   - Fix `--md-sys-color-background`, `--md-sys-color-surface-variant`, `--md-sys-color-inverse-surface`, and `--md-sys-color-inverse-on-surface`.
   - Add missing aliases: `--aura-on-primary`, `--aura-radius-{sm,md,lg,xl,2xl,pill}`, `--aura-duration-{fast,base}`, `--aura-glass-blur`, `--aura-glass-border`, `--aura-bg-elevated`, `--aura-bg-high`, `--aura-shadow-{md,lg}`.
2. Edit `src/styles/brand-tokens.css:5` to update the header comment address to `29 Nguyễn Tất Thành, Sa Đéc`.
3. Edit `src/config/brand-theme.ts` so `--aura-font-display` preserves `'Quicksand'` priority if configured or aligns with `aura-tokens.css`.
4. Edit `scripts/contrast-check.mjs` to add `background/on-background`, `surface-variant/on-surface-variant`, and `inverse-surface/inverse-on-surface` to the verified pairs list.
5. Edit `src/components/ui/drawer.tsx:33-58` to use valid M3 surface tokens (`bg-[var(--md-sys-color-surface-container-high,#162F4D)]`) and add `inert={!open || undefined}` + `aria-hidden={!open}` + Escape key handler so closed drawers are removed from keyboard Tab order.
6. Replace banned Gold hex in `PointsToast.tsx:58`, `RecommendationCarousel.tsx:86`, `TableReservation.tsx:78,224`, `CustomerDisplay.tsx:87`, `OrderSuccess.tsx:22`, and fix `bg-white` cards in `Analytics.tsx:244` and `Bookings-calendar-view.tsx:84`.

## Todo List
- [x] Fix 3 inverted dark-theme M3 token pairs in `src/styles/aura-tokens.css`
- [x] Add missing `--aura-*` alias variables in `src/styles/aura-tokens.css`
- [x] Expand `scripts/contrast-check.mjs` to 11 pairs and verify 100% PASS
- [x] Fix `drawer.tsx` surface token and closed-state `inert` / `aria-hidden` + Escape handling
- [x] Remove banned Gold/Amber hex (`#D4AF37`, `#FFD700`) and light-mode `bg-white` admin cards

## Success Criteria
- `node scripts/contrast-check.mjs` outputs 11 PASS / 0 FAIL.
- `MD3Snackbar` and `Drawer` render with opaque, high-contrast dark-theme surfaces.

## Risk Assessment
- **Risk:** Existing contrast or token unit tests may check specific CSS variable values.
- **Mitigation:** Verify against `src/components/md3/__tests__/a11y-audit.test.tsx`.

## Security Considerations
- None (CSS/token layer only).

## Next Steps
- Run `npm run check:contrast` in Phase 05.
