# Font Token Migration: Legacy Font Stacks Were Never Actually Rendering

**Date**: 2026-09-10 02:30
**Severity**: Medium (real rendering fix masked as a style refactor)
**Component**: Stitch components, stitch pages, aura design tokens, global CSS
**Status**: Resolved

## What Happened

Commit e0a3621 on main: migrated all literal font stacks (`'Space Grotesk'`, `'Libre Caslon Text'`, `'Cormorant Garamond'`) to aura CSS tokens (`--aura-font-body`, `--aura-font-display`, `--aura-font-display-serif`, `--aura-font-mono`). 24 files changed, +47/-40, across 23 stitch component/theme files and 5 stitch pages (`src/components/stitch/**`, `src/pages/stitch/**`, `src/theme/aura-tokens.ts`, `src/styles/global.css`).

The kicker: **the legacy fonts were never loaded as webfonts**. `index.html` only loads Quicksand + Be Vietnam Pro. Every literal stack referencing Space Grotesk / Libre Caslon / Cormorant Garamond has been silently falling back to generic system fonts for months. This "refactor" fixed actual rendering, not just token hygiene.

Also removed a dead Google Fonts `@import` from `StitchAdminLoginNew-styles.ts` — 2 wasted HTTP requests per admin-login render.

Verification: `tsc --noEmit` exit 0, vite build clean, full vitest 355/355 suites, 3228/3228 tests pass. Code review PASS with 3 findings all fixed (dead @import HIGH, stale global.css comment LOW, redundant `var()` fallbacks LOW x2). Docs updated: `01_GOAL.md`, `03_ARCHITECTURE.md` typography sections, `12_CHANGELOG.md` Unreleased entry.

## The Brutal Truth

We shipped "brand typography" that never rendered. Months of literal font stacks pointing at fonts nobody loaded. Users saw system sans-serif everywhere we claimed Cormorant Garamond. Docs made it worse — `01_GOAL.md` and `03_ARCHITECTURE.md` swore the brand was Cormorant/Space Grotesk/JetBrains Mono while the app rendered Quicksand/Be Vietnam Pro. Nobody eyeballed the rendered pages against the docs, so the drift compounded. This is what happens when "migrate to tokens" is treated as a style chore instead of an audit: the audit would have caught the webfont gap in 5 minutes of DevTools.

## Technical Details

- Literal stacks lived in ~24 files: `font-family: 'Space Grotesk', sans-serif` etc.
- Token surface: `--aura-font-body`, `--aura-font-display`, `--aura-font-display-serif`, `--aura-font-mono` in `src/theme/aura-tokens.ts` + `src/styles/global.css`
- Dead `@import url('https://fonts.googleapis.com/...')` in `StitchAdminLoginNew-styles.ts` — browsers fetch @import'd URLs even when unused by any rule
- Verification: `tsc --noEmit` (0 errors) → vite build (ok) → vitest full suite 355 suites / 3228 tests, 0 failures
- Review report: `plans/reports/reviewer-260910-font-token-migration.md`

## What We Tried

- Straightforward find/replace of literal stacks to `var(--aura-font-*)` tokens per file — worked, no type fallout
- Review pass flagged redundant `var(--token, fallback)` double-wrapping where token already had fallback — stripped the redundant outer fallbacks
- Stale comment in `global.css` referencing old font strategy — corrected

## Root Cause Analysis

Stitch bulk imports embed literal font stacks from generated code, and nothing at import time validated those fonts against `index.html` webfont links. Combined with docs claiming the legacy fonts as brand truth, the drift was invisible: code "said" Cormorant, docs "said" Cormorant, browser rendered system default. Two failure layers:

1. No import-time gate: font names in generated code vs actually-loaded webfonts — never cross-checked
2. Docs-as-brand-truth written once, never re-verified against rendered output

Secondary process failure: a stale teammate test report claimed 2 worker regressions (`homeassistant/index.ts:31`, `offline-queue.ts:60` "deleted lines"). Both FALSE — `git diff HEAD` showed zero changes to worker files and the full 3228-test suite ran green. Chasing it would have burned an hour on ghosts.

## Lessons Learned

1. **A font-family declaration is a claim, not a guarantee.** Unless the font is a webfont link in `index.html` (or OS default), it's a fallback chain ending in generic system font. Audit any font claim against loaded resources, not against docs.
2. **Always re-verify teammate failure reports against the live working tree before acting.** `git diff HEAD` + full test run debunked the "worker regressions" in minutes. A stale report is worse than no report — it sends you fixing ghosts.
3. **Token migration is an audit opportunity, not a rename.** Every literal → token swap should ask "does this token actually resolve to something loaded?" We found one that doesn't (see mono below).
4. **Docs drift silently.** Typography "brand" in `01_GOAL.md`/`03_ARCHITECTURE.md` had no re-verification loop against rendered output. When a doc claims a font, either link the webfont loader or delete the claim.

## Out-of-Scope (Preserved Intentionally)

- 57 non-stitch files (mobile/PWA) still carry literal fonts: `recommendation-section.tsx:69` (EB Garamond), `push-notification-toggle-styles.ts:9`, `ReviewsPage-write-review-form.tsx:53`, `BrandGuideline.tsx:23-24` (brand copy — intentionally kept)
- `--aura-font-mono` resolves to JetBrains Mono / IBM Plex Mono which are NOT webfont-loaded — falls back to system monospace (pre-existing gap, now visible because the token surface is consolidated)
- 3 dead Python migration scripts in `src/components/stitch/` still contain old literals
- Contrast gate reported 8 pairs not 9 (all PASS) — flagged by teammate, possibly intentional; needs owner confirmation

## Next Steps

- **Extend migration to the 57 mobile/PWA files** with literal fonts — same pattern, batched. Owner: dev. Next session.
- **Load a real mono webfont or change `--aura-font-mono`** to a system-mono stack. Decide instead of shipping a silently-failing token. Owner: dev + design. This week.
- **Delete the 3 dead Python migration scripts** in `src/components/stitch/`. Owner: dev. Next commit.
- **Confirm contrast-gate pair count** (8 vs 9) — intentional or a dropped selector? Owner: dev.
- **Add a CI font-claim check:** grep font-family literals in src/, cross-reference names against `index.html` webfont links. Fails on any un-loaded font claim. Prevents this entire class of bug. Owner: dev. Next sprint.
