---
phase: 1
title: "i18n + Fonts"
status: completed
priority: P1
dependencies: []
---

# Phase 1: i18n + Fonts

## Overview

Fix user-facing i18n gaps and brand-critical font issues. 3 independent sub-tasks run in parallel.

## Requirements

- **Functional:** Add 5 missing i18n namespaces to both en.json and vi.json
- **Functional:** Fix 2 wrong font-family fallbacks in StitchOrderSuccessNew
- **Non-functional:** Font files must load in production (Space Grotesk + Cormorant Garamond, or fallback)

## Related Code Files

- Modify: `src/locales/en.json`
- Modify: `src/locales/vi.json`
- Modify: `src/components/stitch/StitchOrderSuccessNew.tsx`
- Modify: `src/styles/brand-tokens.css` (if switching font source)
- Modify: `index.html` (if switching to Google Fonts CDN)

## Sub-task 1a: Translation Keys

Read existing locale files for key format patterns. Add keys for:

| Namespace | Count | Source Component |
|-----------|-------|-----------------|
| `kds.*` | ~30 | StitchKDSNew (dashboard, tickets, prep, alerts) |
| `posNew.*` | ~33 | StitchPOSNew (menu, cart, payment, categories) |
| `containerNew1.*` | ~40 | StitchContainerNew1 (features, nav, footer) |
| `containerNew2.*` | ~45 | StitchContainerNew2 (cards, sections, cta) |
| `stitch.ordering.*` | ~22 | StitchMobileOrderNew (menu, cart, checkout) |

**Pattern:** Extract keys from each component's `t()` calls (including `defaultValue` args), author both EN and VI translations.

**VN language note:** Use friendly, casual tone matching the existing "Cà phê" / "Quý khách" pattern in current translations.

## Sub-task 1b: Font Fallback Fix

Two instances in StitchOrderSuccessNew.tsx (~lines 235, 508):

```
style={{ fontFamily: "var(--aura-font-display-serif, 'EB Garamond', serif)" }}
```

Replace `'EB Garamond'` → `'Cormorant Garamond'` to match the design system.

## Sub-task 1c: Font Files Resolution

**Problem:** brand-tokens.css references Space Grotesk + Cormorant Garamond woff2 files via `url('../../fonts/...')` but these files don't exist on disk. Only PlusJakartaSans is present.

**Option A (Recommended):** Add Google Fonts `<link>` tags in `index.html`:
```html
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&family=Cormorant+Garamond:ital,wght@0,300..700;1,400&display=swap" rel="stylesheet">
```
Then update `brand-tokens.css` to use the CDN-loaded fonts without file references.

**Option B:** Download woff2 files and place in `fonts/` directory — fragile, requires maintenance.

**Option C:** Switch to PlusJakartaSans (already on disk) — avoids the font issue entirely but changes the brand look.

## Success Criteria

- [ ] All `t()` calls in StitchKDSNew resolve to translated strings (not raw keys)
- [ ] All `t()` calls in StitchPOSNew resolve to translated strings
- [ ] All `t()` calls in StitchContainerNew1/2 resolve to translated strings
- [ ] All `t()` calls in StitchMobileOrderNew resolve to translated strings
- [ ] Both en.json and vi.json have synchronized keys
- [ ] StitchOrderSuccessNew uses 'Cormorant Garamond' as display font fallback
- [ ] Font files load correctly (not 404) in production build
- [ ] Build passes with 0 errors
