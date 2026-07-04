# Full Quality Pass — Stitch Component Integration

**Date:** 2026-07-04 18:15
**Project:** FnB-Container-Caffe (AURA CAFE)
**Mode:** --plan --deep --parallel

## Context

26 Stitch New components were recently integrated into 13 page routes. Build + 1161 tests pass. Quality audit surfaced 4 systemic issue clusters.

## Problem Statement

The Stitch New components were bulk-converted from HTML exports without aligning to the existing AURA CAFE design token system. This created:

- **Users affected:** Bilingual VN customers (no translations), keyboard users (no focus traps), mobile users (small touch targets)
- **Brand affected:** Bronze palette dominates instead of chrome/silver, wrong fonts referenced
- **Maintainability affected:** 60+ hardcoded hex colors vs CSS custom properties
- **Cause:** Bulk conversion bypassed token system; no pre-commit color/client check

## Track Breakdown

### Track 1: i18n + Fonts (HIGH user impact)
- 5 missing i18n namespaces: kds (30+), posNew (33+), containerNew1 (40+), containerNew2 (45+), stitch.ordering (22+)
- 2 wrong font fallbacks in StitchOrderSuccessNew (EB Garamond → Cormorant Garamond)
- Missing font files: Space Grotesk + Cormorant Garamond (only PlusJakartaSans exists on disk)
- **Files:** src/locales/en.json, src/locales/vi.json, src/components/stitch/StitchOrderSuccessNew.tsx, fonts/*.woff2, index.html

### Track 2: Palette Alignment (MODERATE brand impact)
- 14 hardcoded `#D4A574` (bronze) → `--aura-chrome-light`
- 2+ `#efbd8a` (bronze CTA) → `--aura-primary`
- Audit remaining hex colors across 26 New components
- **Files:** StitchCheckoutNew, StitchLandingNew, StitchContainerNew1/2, StitchMobileOrderNew, StitchEventsNew1

### Track 3: Accessibility Fixes (LEGAL/compliance impact)
- Focus traps: StitchHeader mobile drawer, StitchKDSNew sidebar, StitchAdminTerminalNew sidebar
- Skip-to-content link in StitchAppLayout
- Touch targets: w-7/h-7 (28px) → min-w-[44px] min-h-[44px] in quantity controls
- **Files:** StitchHeader.tsx, StitchKDSNew.tsx, StitchAdminTerminalNew.tsx, StitchAppLayout.tsx, StitchMobileOrderNew.tsx, StitchPOSNew.tsx

### Track 4: Token Migration (SYSTEMIC maintainability impact)
- 60+ hardcoded hex colors → `--aura-*` CSS custom properties
- Font-family inline styles → Tailwind `font-display`/`font-body` classes
- **Files:** StitchMenuGrid.tsx, StitchZones.tsx, StitchStats.tsx, StitchTestimonials.tsx, StitchLocation.tsx

## Execution Strategy

All 8 sub-tasks run in parallel agents. Verify with build + 1161 tests.

## Success Criteria
- `npm run build` → 0 errors
- `npm test` → 1161/1161 passing
- All 5 i18n namespaces populated (en + vi)
- Bronze accent tamed to tertiary-only usage
- Focus traps working in 3 mobile drawers
- Skip-to-content link present
- Touch targets ≥ 44px on mobile controls
- Hardcoded colors reduced by 80%+

## Risks
- i18n key naming may diverge if not following existing pattern (use en.json/vi.json current keys as reference)
- Font download may fail → fallback to Google Fonts link tag
- Token migration may miss instances → grep-based review
