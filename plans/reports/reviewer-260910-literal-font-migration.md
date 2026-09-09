# Reviewer Report — Literal Font Migration (12 files)

**Date:** 2026-09-10
**Scope:** 12 files, `fontFamily` literal-stack → `var(--aura-font-*)` token swaps. Diff 29 insertions / 29 deletions (verified balanced via `git diff --stat`).
**Mode:** Review-only. No edits. No commits.
**Verdict:** **PASS** (a–e all green).

## Acceptance Criteria Verification

### AC1 — No literal fonts remain in src/ (outside stitch/md3)
**PASS.**

`grep -rn 'EB Garamond' | 'Space Grotesk'` (quoted CSS-string form) over `src/**/*.{ts,tsx,css}`, excluding `components/stitch/` and `components/md3/`, returns **3 matches, all intentional exclusions:**

| File | Reason | Status |
|------|--------|--------|
| `src/pages/BrandGuideline.tsx:23-25` | Static `FONTS_DATA` UI spec listing EB Garamond / Space Grotesk as **data strings** (labels in a typography showcase). Not rendered as `fontFamily` — consumed by `TypographyShowcase` only as a name label. | Intentional exclusion |
| `src/components/brand/TypographyShowcase.tsx` | The `getFontFamily()` helper **maps names to aura tokens**: `Quicksand` → `Quicksand, var(--aura-font-display)`, `Be Vietnam Pro` → `"Be Vietnam Pro", var(--aura-font-body)`, `JetBrains Mono` → `JetBrains Mono, monospace`. No literal Space Grotesk / EB Garamond / system-ui reach render. Font names in its data model are intentional showcase input. | Intentional exclusion |
| `src/styles/brand-tokens.css:20` | Comment block referencing the old v6 font lineage. Not code. | Benign |

Note: `brand-tokens.css` and `global.css` also contain legacy `--font-display: var(--aura-font-display)` alias **definitions** (AC2 domain, see below) — those are aliasing, not the literal font strings AC1 hunts. AC1 only checks for the literal font strings themselves, which are fully cleared outside the showabove exclusions.

### AC2 — `var(--font-display)` cleared outside legacy alias defs + TypographyShowcase
**PASS.**

`grep 'var(--font-display)' src/` returns **one** live usage:
- `src/styles/global.css:104` — `font-family: var(--font-display);` inside the `h1,h2,h3,h4,h5,h6 {}` rule.

The alias *definitions* are `brand-tokens.css:248` and `global.css:31` (`--font-display: var(--aura-font-display)`). These are the allowed legacy-alias sites the plan explicitly calls out as "still intentionally used in global.css:104" — **confirmed exactly one live consumer (h1–h6 rule) remains.**

`TypographyShowcase.tsx` uses only `var(--aura-font-display)` and `var(--aura-font-body)` tokens (via helper), never the legacy `--font-display` alias.

No other `var(--font-display)` consumers exist. The migration collapses one stale `var(--font-display)` reference in `hero-section.tsx` (line 123) to the canonical `var(--aura-font-display)` — strictly an improvement.

### AC3–AC6 — Gate results (gate-verified by tester, not re-run)
**PASS (cited).** `plans/reports/tester-260910-literal-font-migration.md`:
- Gate 1 `npx tsc --noEmit` exit 0, 0 errors.
- Gate 2 `npx vite build` exit 0, `✓ built in 3.27s`, main 584.12 kB / gzip 144.10 kB.
- Gate 3 `npx vitest run` exit 0, **355/355 suites, 3228/3228 tests**, matches baseline, 53.83s.
- Gate 4 `npx eslint <12 files>` exit 0 — **non-blocking caveat:** all 12 files return `File ignored because no matching configuration was supplied` (ESLint v9 flat config only wires `worker/src/**/*.ts`; `src/**` matches no config block). Verified pre-existing (same warning on untouched `src/App.tsx` and on stashed HEAD), not migration-caused. Repo-wide config gap. Tester recommends a future `src/**/*.{ts,tsx}` block — agree, but out of scope.

### AC7 — Diff contains ONLY fontFamily changes
**PASS.** Walked every hunk of the 12-file diff. Every hunk is a single `fontFamily` value replacement. No imports, exports, props, types, logic, JSX structure, or other style properties changed.

Minor nuance flagged by tester, confirmed benign: `hero-section.tsx:123` diff line bundles `bg-[#0A1A2E]` because the property sits on the same source line as the `fontFamily` edit — it is part of the unchanged surrounding line context, not a new change. The hunk is `+/- 1` balanced and modifies only the `fontFamily` substring.

## Reviewer Checklist

### (a) Acceptance criteria
**PASS.** AC1, AC2, AC7 verified by direct grep/diff inspection above; AC3–AC6 gate-verified by tester report cited.

### (b) No regression to business logic / blast radius
**PASS.** All 12 files contain only style objects (`React.CSSProperties` constants) or inline `style={{ fontFamily }}` props. No state, effects, event handlers, imports, or exports were touched. Touchpoints (waiter orders, kitchen display, mobile layout, register/verify-email SaaS tenant-create, push-notification toggle, reviews form, account error/not-logged-in, menu recommendation, home hero) are pure-presentation; routing and data flow unchanged.

### (c) No breaking changes to public contracts
**PASS.** No function signatures, no exported type/interface changes. Exported const names (`wrap`, `logoutBtn`, `formInput`, `btnAdd`, `btnRemove`, `btnSubmit`, `select`, `tabStyle`, `btnStart`, `btnReady`, `styles`, `tabStyle`, etc.) and their value types (`CSSProperties` / `Record<string, CSSProperties>`) are identical. The exported *shape* of every module is byte-for-byte the same except the `fontFamily` string literal inside property values — a back-compatible refinement (tokens resolve to the same font families that index.html already loads).

### (d) Follows existing repo idiom
**PASS.** Repo already uses bare `var(--aura-font-*)` tokens in fontFamily without hex fallbacks across the stitch system (verified: `loyalty-weekly-streak.tsx`, `StitchMenuNew-*.tsx`, `StitchEventsNew2-form.tsx`, `stitch-about-error.tsx`, etc. all use `fontFamily: 'var(--aura-font-display)'` / `'var(--aura-font-body)'` / `'var(--aura-font-display-serif)'`). The 12 new values match that idiom exactly — tokens are guaranteed on `:root` (brand-tokens.css:85,104,105) so bare usage is correct and consistent. Migration also brings `register/index.tsx`, `verify-email/index.tsx`, `tenant-create.tsx` (system-ui), the mobile styles (Space Grotesk), recommendation-section / reviews / account files (EB Garamond), and hero-section (stale `--font-display` alias) into the same canonical-token idiom.

### (e) No new lint/type/build errors
**PASS.** Gate 1–3 cover typecheck, build, full test suite — all green (tester report). The 9 extra dirty files in the working tree (see below) are out of scope; none of them break these gates since gates were run green on the current tree.

## Findings

**None blocking.** All 12 changes are correct, balanced, and idiomatic.

### Informational observations

1. **var() chain collapse is safe.** Three files (`ReviewsPage-write-review-form.tsx`, `account-error.tsx`, `account-not-logged-in.tsx`) previously used `'var(--aura-font-display, "EB Garamond", Georgia, serif)'` — a CSS custom-property with literal fallbacks. That fallback chain was dead weight: index.html loads only Quicksand + Be Vietnam Pro webfonts, **EB Garamond and Georgia are never fetched** — the previous chain silently fell through to the browser's default serif. Collapsing to `var(--aura-font-display-serif)` makes rendering deterministic and removes a dead reference. No regression.

2. **TypographyShowcase / BrandGuideline intentional exclusions confirmed clean.** TypographyShowcase's `getFontFamily()` helper maps canonical font names to aura tokens; the literal names (Quicksand, Be Vietnam Pro, JetBrains Mono) exist only as data labels and as the single literal families that index.html actually loads. Space Grotesk / EB Garamond never render through this path. BrandGuideline's `FONTS_DATA` array lists EB Garamond / Space Grotesk as human-readable spec labels in a typography specimen page — not as CSS font stacks. Both are correctly excluded.

3. **ESLint config gap (repo-wide, non-blocking).** ESLint v9 flat config (`eslint.config.js`) only declares `files: ["worker/src/**/*.ts"]`, so `src/**` is silently skipped — Gate 4 "passes" by exit code but lints nothing. Pre-existing and migration-agnostic (verified against untouched `App.tsx` and stashed HEAD). Tester recommends adding a `src/**/*.{ts,tsx}` block — **agree**, but it is a follow-up, not a migration fix.

## Pre-existing unrelated diffs (EXCLUDE from this change's commit)

The working tree has **11 dirty files** beyond the 12 migration files. Per lead instruction these are out-of-scope and must NOT be bundled into any commit of this font migration. Listing here for completeness; I did not review them:

- `.gitignore` — adds `.dev.vars*`, `*.pem`, `*.key` patterns.
- `worker/wrangler.toml` — `CORS_ORIGIN = "*"` → `"https://auraspace.cafe"` (security-relevant but out of scope).
- **9 feature-work files (225 insertions / 39 deletions) NOT in the lead's out-of-scope list — flag raised here:**
  - `src/components/stitch/StitchCheckoutNew-order-summary.tsx` (1 line)
  - `src/components/stitch/StitchCheckoutNew-types.ts` (4 lines)
  - `src/components/stitch/StitchCheckoutNew.tsx` (128 lines)
  - `src/hooks/use-promotions.ts` (33 lines)
  - `src/pages/checkout.tsx` (6 lines)
  - `src/pages/promotions.tsx` (64 lines)
  - `worker/src/routes/promotions.ts` (16 lines)
  - `src/hooks/use-promotions.ts`, `worker/src/tree/loyalty/lookup-handler.ts` (4 lines)
  - `worker/src/tree/orders/telegram.ts` (7 lines)

  **Assessment of the 9 flagged files:** Not font-related (checkout rewrite + promotions feature). None modify the 12 migration files. No shared-file conflict with this migration. I did not review them (out of scope). Recommend lead triages them into a separate change so this font-migration commit stays a clean 12-file, 29/29, fontFamily-only diff.

## Severity summary
- Critical: 0
- High: 0
- Medium: 0
- Low / informational: 3 (all listed above)

## Final Verdict
**PASS.** All checklist items (a–e) green. Every acceptance criterion met. The 12-file diff is a balanced, fontFamily-only migration that clears dead literal-font references, collapses dead fallback chains, and brings every touched file into the existing `var(--aura-font-*)` idiom. Recommend commit as a standalone 12-file unit, excluding the 11 dirty out-of-scope files.

## Unresolved Questions
1. Add a `src/**/*.{ts,tsx}` config block to `eslint.config.js` so future Gate 4 lints real source? (Repo-wide gap, not this migration.)
2. Triage the 9 dirty feature-work files (checkout/promotions) into their own change so this migration ships as a clean 12-file commit.
