# Literal Font Stack Migration — Aura Tokens (Mobile/PWA/Internal)

**Date:** 2026-09-10 · **Plan:** plans/260910-0337-literal-font-migration-mobile-pwa · **Commit:** 50e2f29

## What

12 files, 29/29 balanced single-line `fontFamily` swaps. Literal stacks → aura tokens:

- `"Space Grotesk", sans-serif` → `var(--aura-font-body)` — waiter-orders-constants (7), push-notification-toggle-styles (6), kitchen-display-styles (3), mobile-layout-styles (3)
- `system-ui, sans-serif` → `var(--aura-font-body)` — tenant-create (2), register (1), verify-email (1)
- `"EB Garamond", Georgia, serif` → `var(--aura-font-display-serif)` — recommendation-section (2)
- Var() chain collapse: `var(--aura-font-display, "EB Garamond", …)` → bare token — ReviewsPage form (→ display-serif), account-error, account-not-logged-in (→ display)
- Stale token: `var(--font-display)` → `var(--aura-font-display)` — hero-section (1)

## Why

index.html loads only Quicksand + Be Vietnam Pro. Space Grotesk / EB Garamond / system-ui literals were never webfont-loaded — dead references silently falling back to browser defaults. Migration makes rendering deterministic and DRYs font usage to the token system.

## Verification

- tsc --noEmit: 0 errors
- vite build: 3.27s, exit 0
- vitest: 355/355 suites, 3228/3228 tests (baseline match)
- eslint: exit 0 (12 files ignored by flat config — pre-existing repo-wide gap, verified on clean HEAD via stash)
- Reviewer: PASS — 0 critical/high/medium; 3 Low informational

## Key decisions

1. Space Grotesk/system-ui → `--aura-font-body` (not display): target files are body/forms/buttons, Be Vietnam Pro is semantic match
2. Bare `var()` without fallbacks — tokens guaranteed on `:root` (brand-tokens.css:104-105)
3. Font-only scope — raw hex colors untouched (user-confirmed)

## Residual / follow-ups

- `eslint.config.js` flat config has no `src/**/*.{ts,tsx}` block → ESLint v9 ignores all src files. Candidate future fix (repo-wide, not this task)
- `global.css:104` h1-h6 still uses legacy alias `var(--font-display)` (defined, working; intentional exclusion)
- TypographyShowcase.tsx keeps font-name literals (showcase data labels → maps to aura tokens internally)
- Raw hex color migration for mobile files (orange Tailwind palette #F97316 etc.) — deferred, separate plan
- 9 dirty files in working tree (StitchCheckoutNew family, promotions, worker routes) — out of scope, untouched, uncommitted

## Reports

- plans/reports/tester-260910-literal-font-migration.md
- plans/reports/reviewer-260910-literal-font-migration.md
