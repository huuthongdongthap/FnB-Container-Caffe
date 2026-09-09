# Code Review — Font Token Migration

**Scope**: `git diff -- src/components/stitch src/pages/stitch src/theme` (18 files, 31 lines changed)
**Date**: 2026-09-10
**Verdict**: **PASS with findings**

---

## 1. Acceptance Criteria

| # | Criterion | Status |
|---|-----------|--------|
| AC1 | No literal `'Space Grotesk'` or `'Libre Caslon'` in scope | ✅ PASS |
| AC2 | All token refs resolve to defined aura CSS vars | ✅ PASS |
| AC3 | Values-only edits, no logic changes | ✅ PASS |
| AC4 | Fallback-pattern consistency (no render risk) | ⚠️ LOW inconsistency (cosmetic) |
| AC5 | var() fallbacks removed only where token IS globally defined | ✅ PASS |

### AC1 — Literal font names in scope
Grep across `src/components/stitch`, `src/pages/stitch`, `src/theme` for `*.ts/*.tsx/*.css` — **zero hits** after this diff. Three Python migration scripts (`_apply_all_fixes.py`, `_apply_fixes_v2.py`, `_insert_components.py`) still contain old literals but they are dead tooling, not in the review scope, and are not imported by any build artifact.

Outside the diff scope, stale literals exist in 3 files — pre-existing, not introduced by this diff:
- `src/components/stitch/StitchAdminLoginNew-styles.ts:11` — dead `@import url(...)` (Cormorant Garamond + Space Grotesk webfonts no longer used by any rule)
- `src/components/menu/recommendation-section.tsx:69` — `"EB Garamond", Georgia, serif`
- `src/components/pwa/push-notification-toggle-styles.ts:9` — `"Space Grotesk", system-ui, sans-serif`
- `src/pages/ReviewsPage-write-review-form.tsx:53` — `var(--aura-font-display, "EB Garamond", Georgia, serif)`

### AC2 — Token existence
All four aura font tokens referenced by the diff are defined in `src/styles/brand-tokens.css` and transitively imported into the page via `src/main.tsx → src/styles/global.css (:31-33) → src/styles/brand-tokens.css (:104-106, :85)`:

| Token | Definition | Value |
|-------|-----------|-------|
| `--aura-font-display` | `brand-tokens.css:104` | `'Quicksand', 'Be Vietnam Pro', sans-serif` |
| `--aura-font-body` | `brand-tokens.css:105` | `'Be Vietnam Pro', 'Quicksand', sans-serif` |
| `--aura-font-mono` | `brand-tokens.css:106` | `'JetBrains Mono', 'IBM Plex Mono', monospace` |
| `--aura-font-display-serif` | `brand-tokens.css:85` | `var(--aura-font-display)` |

Webfonts are loaded in `index.html` (lines 15-16): Quicksand + Be Vietnam Pro only. JetBrains Mono / IBM Plex Mono are NOT webfont-loaded — their `var(--aura-font-mono)` values will fall back to system monospace fonts; this is pre-existing behavior, not changed by this diff.

### AC4 — Fallback pattern inconsistency (cosmetic, no render risk)
Two files in the diff keep a redundant fallback while two others don't:
- `stitch-about-cta-section.tsx:28` and `stitch-about-hero-section.tsx:41` use `var(--aura-font-display-serif, var(--aura-font-display))`
- `StitchEventsNew2-form.tsx:124` and `StitchEventsNew2-header.tsx:37` use bare `var(--aura-font-display-serif)`

Functionally equivalent since `--aura-font-display-serif` IS defined. Not a render risk, but stylistically inconsistent.

---

## 2. Regression Risk in Touchpoints

**Consumers of `SPACE_GROTESK` / `LIBRE_CASLON` constants** (10 files):
- `StitchHeroNew-{footer,navbar,visual-teaser,hero,features}.tsx` import these constants and pass them directly as `fontFamily` values.
- These files were migrated in prior commit `51492a1` (batch 4, already pushed).
- The current diff redefines the constants from broken literal stacks (`'Space Grotesk', sans-serif` and `'Libre Caslon Text', Georgia, serif`) to `var(--aura-font-body)` and `var(--aura-font-display)` respectively.
- **Result**: all existing consumers now receive aura CSS var tokens — correct behavior. No interface break.

**`COLORS` / `FONTS` from `stitch-container-new2-types.ts`**:
- `stitch-container-new2-types.ts:95` changed `COLORS.body` from `'Space Grotesk', sans-serif` to `var(--aura-font-body)`. However, `COLORS.body` is unused (no file greps for `COLORS.body` with font intent). The diff also touches `FONTS` indirectly via the file, but `FONTS.display` and `FONTS.body` were already aura token refs from a prior commit — this diff only touches `COLORS.body`. Safe.

**`src/theme/aura-tokens.ts`** (lines 47-48, 78-79):
- Both `lightTokens.fontFamily` and `darkTokens.fontFamily` now use bare `var(--aura-font-display)` / `var(--aura-font-body)`.
- Only consumer is `use-aura-theme.ts` (dark-only path). No behavioral change.

---

## 3. Breaking Changes to Public Contracts

- `SPACE_GROTESK` and `LIBRE_CASLON` still exported from `StitchHeroNew-types.ts` — contract preserved (values changed, names unchanged).
- `COLORS.body` value changed but not a documented public contract.
- No type changes, no export removals.

---

## 4. Findings (3 issues, none blocking)

| # | Severity | File:Line | Description |
|---|----------|-----------|-------------|
| F1 | **HIGH** | `src/components/stitch/StitchAdminLoginNew-styles.ts:11` | `@import url(...)` loads Cormorant Garamond + Space Grotesk webfonts that are **no longer referenced by any CSS rule** in the file (all rules now use `var(--aura-font-body)` or `var(--aura-font-display)`). Causes 2 unnecessary Google Fonts HTTP requests on every admin-login render. Pre-existing issue, but directly in-scope for a font migration. |
| F2 | LOW | `src/styles/global.css:13` | Comment `/* Brand tokens: EB Garamond + Space Grotesk */` is stale — current stack is Quicksand + Be Vietnam Pro. Cosmetic only. |
| F3 | LOW | `src/components/stitch/stitch-about-cta-section.tsx:28`, `stitch-about-hero-section.tsx:41` | Redundant `var(--aura-font-display-serif, var(--aura-font-display))` fallback differs from the bare-var pattern used elsewhere in this batch. Cosmetic only. |

---

## 5. Recommendations

1. **Fix F1** — remove the `@import url(...)` from `getLoginStyles()`. It is dead weight after this migration.
2. **Fix F2** — update the stale comment in `global.css:13`.
3. **Fix F3** — normalize to bare `var(--aura-font-display-serif)` for consistency.

---

## Unresolved Questions

None — all 5 acceptance criteria are verified against live source. Pre-existing stale literals in `recommendation-section.tsx`, `push-notification-toggle-styles.ts`, and `ReviewsPage-write-review-form.tsx` are outside this diff's scope but should be swept in a follow-up pass.
