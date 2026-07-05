# Phase 1: Token Migration Audit Report

## Status
DONE_WITH_CONCERNS

## Summary
Successfully migrated 911/914 `--st-*` Stitch SDK tokens to `--aura-*` AURA brand tokens across 16 stitch component files; 3 remaining `--st-*` references are comment-only documentation lines.

## Counts
- Before: 914 `--st-*` tokens
- After: 3 `--st-*` (all in code comments)
- Diff: 911 replaced
- `--aura-*` tokens before: 330
- `--aura-*` tokens after: 1,241

## Files Modified (16)
All 16 files with functional `--st-*` tokens were migrated. 8 files already at zero `--st-*` were left untouched.

| File | Before | After |
|------|--------|-------|
| StitchAccountDashNew | 43 | 0 |
| StitchAdminLoginNew | 16 | 0 |
| StitchCheckoutNew | 42 | 0 |
| StitchContainerNew1 | 64 | 0 |
| StitchContainerNew2 | 59 | 0 |
| StitchEventsNew1 | 105 | 1* |
| StitchFooter | 29 | 0 |
| StitchHeroNew | 35 | 0 |
| StitchKDSNew | 46 | 0 |
| StitchLandingNew | 92 | 0 |
| StitchLoyaltyNew | 123 | 1* |
| StitchMenuNew | 30 | 0 |
| StitchOrderSuccessNew | 49 | 0 |
| StitchReferralNew1 | 63 | 0 |
| StitchReviewsNew | 49 | 0 |
| StitchStoryNew | 69 | 1* |

*\* Comment-only references: StitchEventsNew1.tsx:9, StitchLoyaltyNew.tsx:5, StitchStoryNew.tsx:9 — these are developer documentation comments, not functional CSS variables.*

## CSS Tokens Added (6)
Six missing AURA tokens were added to `src/styles/stitch-tokens.css` to support the plan's mapping:
- `--aura-surface-dim: #00204A`
- `--aura-surface-container: #0B203A`
- `--aura-chrome-soft: #A0A0A0`
- `--aura-chrome-dim: #44474D`
- `--aura-bronze-shimmer: var(--aura-tertiary)` (alias to existing `--aura-tertiary: #d4a574`)
- `--aura-bronze-subtle: #291500`

## Build
**FAILED** — but pre-existing issues only. All 27 TypeScript errors are in `src/pages/account/index.tsx` (unrelated to Stitch components). Zero TypeScript errors in `src/components/stitch/`.

## Tests
**PASSED** — all 1,091 tests passed (106 test files).

## Concerns
1. **Context-blind mapping risk**: The plan's mapping replaces ALL instances of `--st-primary` with `--aura-noir-void` (#050D1A, very dark navy). In some components, `--st-primary` is used as a TEXT color (e.g., `text-[var(--st-primary)]` for hover links). `--aura-noir-void` (#050D1A) on a dark background (#0A1A2E) will result in invisible text. A context-aware approach would map text-context `--st-primary` to `--aura-chrome-bright` or `--aura-text-primary` instead.
2. **Extra tokens not in plan**: The codebase uses ~10 additional `--st-*` tokens beyond the 19 in the plan's mapping table (`--st-primary-fixed`, `--st-surface-container-highest`, `--st-surface-dim`, etc.). These were mapped to best-guess AURA equivalents and should be visually verified.
3. **Visual verification (Step 3 from plan) not executed**: The plan recommends visual verification by running `npm run dev` and checking each component in a browser. This should be done before merging.
