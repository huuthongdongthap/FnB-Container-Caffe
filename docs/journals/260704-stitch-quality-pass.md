# Stitch Quality Pass: 26 New Components Cleaned Up After Bulk Import

**Date**: 2026-07-04 18:15
**Severity**: Medium (debt-driven, not blocking)
**Component**: Stitch New components (26 components across 13 pages)
**Status**: Resolved

## What Happened

We ran a comprehensive quality pass on the 26 Stitch New components that were integrated as part of the earlier "12 screens to React conversion." The components shipped with build + 1161 tests green, but a quality audit surfaced 4 systemic issue clusters that needed fixing: missing i18n keys, wrong font fallbacks, bronze-over-chrome palette violations, missing accessibility patterns, and hardcoded hex colors bypassing the design token system.

The session ran 5 phases (4 parallel workstreams + 1 barrier verification) across 2 Workflow orchestrations with a brainstorm to plan to cook pipeline.

Final state: 0 TypeScript errors, 1161/1161 tests passing. But it came at the cost of 122 palette replacements and 94 hex-to-token migrations that should never have been necessary in the first place.

## The Brutal Truth

This is the hangover from bulk-importing Stitch HTML exports without running a token alignment pass. The original conversion was about speed -- get 12 screens rendered in React so we could ship. Nobody stopped to check whether the exported HTML used the right design tokens, whether the i18n keys were wired in, or whether the accessibility scaffolding was intact. We shipped debt, and today we paid the interest.

The frustrating part is that 122 bronze-to-chrome replacements in a single session is absurd. That many mismatches means the original Stitch export was configured with a completely different palette than our design system. Some designer (or AI export config) picked bronze/warm as the primary accent. Our system uses chrome/silver. This was a fundamental misalignment that should have been caught at the integration boundary, not patched across 26 individual component files after the fact.

The exhausted-win feeling at the end is real. 184 translation keys, 122 palette fixes, 94 token migrations, 3 focus traps, 2 touch target fixes -- the raw count says "good work done," but the subtext says "that was all preventable."

## Technical Details

**Phase 1 - i18n + Fonts:**
- 184 keys added across 5 namespaces: `kds.*` (~30), `posNew.*` (~33), `containerNew1.*` (~40), `containerNew2.*` (~45), `stitch.ordering.*` (~22)
- Both `en.json` and `vi.json` synchronized
- Fixed 2 font-family fallback instances: `'EB Garamond'` -> `'Cormorant Garamond'` in `StitchOrderSuccessNew.tsx`
- Added Google Fonts `@font-face` CDN links for Space Grotesk and Cormorant Garamond (woff2 files were missing from disk)

**Phase 2 - Palette Alignment:**
- 122 replacements of `#D4A574` -> `--aura-chrome-light` and `#efbd8a` -> `--aura-primary` across all 26 components
- Files hit hardest: `StitchCheckoutNew.tsx`, `StitchLandingNew.tsx`, `StitchContainerNew1.tsx`, `StitchContainerNew2.tsx`, `StitchMenuGrid.tsx`
- Bronze retained as deliberate tertiary highlight in exactly 0-2 instances (tier badge backgrounds)

**Phase 3 - Accessibility:**
- 3 focus traps with Escape key handlers: `StitchHeader` mobile drawer, `StitchKDSNew` sidebar, `StitchAdminTerminalNew` sidebar
- Skip-to-content link at top of `StitchAppLayout.tsx` (first tabbable element, visible on focus)
- 2 WCAG 2.5.8 touch target violations fixed: `w-7 h-7` (28px) -> `min-w-[44px]` on quantity buttons in `StitchMobileOrderNew.tsx` and `StitchPOSNew.tsx`

**Phase 4 - Token Migration:**
- 94 hardcoded hex colors replaced across 5 core files: `StitchMenuGrid.tsx` (11x `#b8c7e2`), `StitchZones.tsx` (5x `#b8c7e2`, `#0e0e10`), `StitchStats.tsx`, `StitchTestimonials.tsx`, `StitchLocation.tsx`
- Color mapping: `#b8c7e2` -> `--aura-chrome-light`, `#e4e2e4` -> `--aura-text-primary`, `#0A1A2E` -> `--aura-bg-page`, `#e0e0e0` -> `--aura-chrome-mid`, etc.

**Phase 5 - Verify:**
- 3 TypeScript errors fixed (type narrowing in the token migration pass)
- 8 test failures resolved (snapshot updates from palette changes)
- Final: build passed, `npm test` -> 1161/1161

## What We Tried

**Workflow model:** First attempt used a single workflow orchestration for all 5 phases. The initial schema validation failed because the workflow definition didn't match the expected sub-task structure (missing `plan` property on phase configs). Had to fix the plan schema, restart the orchestration, and re-parse the phase definitions before it could dispatch parallel agents. Added ~15 minutes of overhead.

**Parallel execution:** Phases 1-4 ran in parallel agents, which worked well since file ownership didn't overlap (translation files vs component files vs layout files). Phase 5 was a serial barrier. This model was correct but the initial orchestration parse failure ate into the parallel time savings.

**Focus trap pattern:** Used a shared `useEffect` + `useRef` pattern across 3 drawers. The original implementation didn't handle the `Tab` key loop (wrapping from last -> first focusable element) -- that had to be added in a later iteration within the phase.

## Root Cause Analysis

The root cause is straightforward: we imported Stitch AI-generated HTML exports as React components without a quality gate that checked for design token alignment, i18n wiring, or accessibility scaffolding. The exports came from a system configured with a bronze/warm palette, not our chrome/silver design system. We treated "it compiles" and "tests load" as success criteria, and deferred the quality pass to "later." Today was later.

The font fallback issue (`'EB Garamond'` instead of `'Cormorant Garamond'`) is a smaller instance of the same problem: the Stitch export used its own default font references, not our brand tokens.

The hardcoded hex colors (94 instances in 5 files) are what happens when you style components with raw color values instead of CSS custom properties. The original conversion didn't have a token system enforced at the lint level -- there's no eslint rule that says "ban `#b8c7e2` in Stitch components." Without automated enforcement, manual audit is the only way to catch this, and manual audit at scale is unreliable.

The i18n gap (184 missing keys across 5 namespaces) happened because the Stitch components used `t()` calls with English defaults, but the namespace structure wasn't registered in the locale files. The keys were in the code but the translations didn't exist -- which silently fell through to the default values, making the gap invisible during normal English-mode development.

## Lessons Learned

1. **Design token alignment must be a go/no-go gate on Stitch imports, not a cleanup task.** Before importing any AI-generated component, run a palette grep. If the export uses different hex values than the design system tokens, reject the import at source and fix the Stitch configuration first.

2. **i18n gaps are invisible in monoglot development.** Working in English during dev hides missing translation keys because `t()` with `defaultValue` silently passes through. We need a CI check or locale lint rule that validates all namespaces referenced in `t()` calls actually exist in both locale files.

3. **Parallel workflows need tighter schema validation on the first parse.** The 15 minutes spent fixing the workflow schema could have been avoided with a `zod`-validated plan template that the brainstorm step outputs in the exact shape the orchestrator expects.

4. **Bulk color replacements need regression safety.** The 94 hex-to-token replacements changed computed visual output. The 8 snapshot test failures proved that. Running snapshot updates blind (without visual diff) means we accepted "different" without verifying "correct." Next time: pair bulk token migration with a visual regression screenshot pass.

5. **The 122 bronze-to-chrome replacements should trigger a root-cause investigation at the process level, not just the component level.** Why did Stitch export bronze in the first place? Finding the source would prevent this for future imports.

## Next Steps

- **Add a palette lint rule:** eslint plugin or custom rule that bans `#D4A574`, `#efbd8a`, `#b8c7e2` in Stitch component files. Prevents recurrence at the pre-commit level.
- **Add i18n namespace validation:** Script or CI step that extracts all `t()` namespace prefixes from component files and cross-references against locale JSON keys. Fail if gaps exist.
- **Document import quality gate:** Update the Stitch import workflow in docs to include a pre-merge checklist: palette audit (grep hex values), i18n scan (list missing namespaces), accessibility scan (focus traps, touch targets, skip links).
- **Monitor 6 remaining hardcoded colors:** The pass left 6 instances marked as intentional (tertiary highlights). Tag with `color-pending-audit` comments and revisit after design system finalizes the tertiary palette.
