---
phase: 2
title: "Palette Alignment"
status: completed
priority: P2
dependencies: []
---

# Phase 2: Palette Alignment

## Overview

AURA CAFE design system specifies chrome/silver as the primary accent. The Stitch New components overuse warm bronze (#D4A574, #efbd8a) as the primary accent — replace with chrome/silver tokens.

## Requirements

- **Functional:** Replace bronze (#D4A574) with `--aura-chrome-light` in all components
- **Functional:** Replace bronze CTA (#efbd8a) with `--aura-primary` (chrome/silver)
- **Non-functional:** Bronze should only appear as a sparing tertiary highlight (≤2 instances acceptable)

## Related Code Files

| File | Bronze Count | Change |
|------|-------------|--------|
| `src/components/stitch/StitchCheckoutNew.tsx` | ~5 | Focus borders, prices, selection → `--aura-primary` |
| `src/components/stitch/StitchLandingNew.tsx` | ~3 | Nav CTA gradient → `--aura-chrome-light` |
| `src/components/stitch/StitchContainerNew1.tsx` | ~3 | Accents → `--aura-chrome-light` |
| `src/components/stitch/StitchContainerNew2.tsx` | ~2 | Accents → `--aura-chrome-light` |
| `src/components/stitch/StitchMobileOrderNew.tsx` | ~1 | Accent → `--aura-primary` |

## Sub-task 2a: Bronze → Chrome Replacement

Grep all components for `#D4A574` and `#efbd8a`, replace each with appropriate chrome/silver token:

| Old Value | New Token | Context |
|-----------|-----------|---------|
| `#D4A574` | `--aura-chrome-light` (or `--aura-primary`) | Interactive accents, focus borders, price highlights |
| `#efbd8a` | `--aura-primary` | CTA buttons, nav highlights |
| `#cd7f32` | `--aura-chrome-mid` | Progress bars, tier indicators |

## Sub-task 2b: Bronze Usage Audit

After replacement, audit all 26 New components:
```bash
grep -rn "#D4A574\|\|efbd8a\|#cd7f32\|bronze" src/components/stitch/ --include="*.tsx"
```

Acceptable: 0-2 instances of bronze as deliberate tertiary highlight (e.g., tier badge background).
Unacceptable: Bronze used as primary interactive accent.

## Success Criteria

- [ ] `#D4A574` replaced with chrome tokens in StitchCheckoutNew, StitchLandingNew, StitchContainerNew1/2, StitchMobileOrderNew
- [ ] `#efbd8a` replaced with `--aura-primary` in CTA buttons
- [ ] Bronze usage audited across ALL 26 components
- [ ] Brand chrome/silver consistency restored
- [ ] Build passes with 0 errors
