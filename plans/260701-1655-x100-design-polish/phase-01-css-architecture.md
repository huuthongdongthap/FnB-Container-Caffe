---
phase: 1
title: "CSS Architecture"
status: pending
priority: P1
dependencies: []
effort: "3-4h"
---

# Phase 1: CSS Architecture

## Overview

Fix verified CSS issues: real dead CSS links, homepage-v6 split, backdrop-filter
cleanup, font alignment, button standardization, keyframe dedup, toast
consolidation, skeleton consolidation, outline:focus-visible replacement, Google
Fonts CDN removal from admin pages.

**Note:** 6 original issues removed after red-team verification — CSS var aliases,
premium-upgrade.css !important refactor, scroll-progress, and Google Fonts CDN
from index.html were already fixed in the codebase.

## TDD Structure

1. **Capture baseline**: Run `npm test` + `grep -c '!important' css/*.css` → record as 212
2. **Write regression tests**: Per-issue E2E visual check
3. **Implement fix**: Each issue fixed in its target file
4. **Verify**: Re-run tests → must match or improve baseline

## Requirements

- Functional: All CSS files load without 404s. No visual regressions.
- Non-functional: `!important` count <80 (from 212, keeping reduced-motion/print/utility).
  homepage-v6.css <1000 lines after split. No duplicate keyframes.
  Single toast system. Single skeleton system.

## Issues to Fix

### #2: Dead CSS links (real ones)
The plan's original "5 dead CSS links" list was wrong — those files exist.
Actual dead links use `../css/` prefix (one level too high):
- `events.html:14`: `../css/events.css` → `css/events.css`
- `loyalty.html:14`: `../css/loyalty.css` → `css/loyalty.css`
- `referral.html:14`: `../css/referral.css` → `css/referral.css`

### #3: homepage-v6.css split (4566 lines → 5 modules)
- `homepage-v6.css` → keep only core (~800 lines)
- Extract into: `homepage-hero.css`, `homepage-sections.css`, `homepage-nav.css`, `homepage-footer.css`, `homepage-responsive.css`
- Link all new files from HTML pages that use them

### #8: Font alignment
- Audit all font-family declarations
- Replace hardcoded fonts with `var(--aura-font-display)`, `var(--aura-font-body)`, `var(--aura-font-utility)`
- Remove conflicting declarations in homepage-v6.css

### #11: Button standardization
- Audit all `.btn-*` variants across CSS files
- Standardize on: `.aura-btn-primary`, `.aura-btn-ghost`, `.aura-btn-outline`, `.aura-btn-sm`
- Update all HTML pages to use standardized classes

### #12: Backdrop-filter cleanup
- Remove `backdrop-filter: blur()` from opaque backgrounds
- Consolidate to `var(--glass-blur)` token where needed
- Files: homepage-v6.css, brand-tokens.css, menu-v6.css

### #14: Remove Google Fonts CDN from admin pages
- index.html already done — but 8+ admin pages still load Google Fonts CDN
- Target: `admin/dashboard.html`, `admin/login.html`, `admin/pos.html`, `admin/customers.html`, `admin/orders.html`, `admin/reservations.html`, `admin/staff.html`, `signup/index.html`
- Keep local woff2 @font-face declarations in brand-tokens.css

### #16: Keyframe deduplication
- Audit 12 animation keyframes (spin, pulse, shimmer, slideUp, scaleIn, etc.)
- Keep one canonical copy in brand-tokens.css
- Remove duplicates from: homepage-v6.css, menu-v6.css, ui-enhancements.css, etc.

### #17: Toast standardization
- Create `.aura-toast` in brand-tokens.css
- Remove 5 variant toasts from: menu-v6.css, contact.css, reservations.css, track-order-styles.css, ui-enhancements.css
- Update JS toast callers to use new class

### #18: Skeleton consolidation
- Keep `animate-shimmer` in brand-tokens.css
- Remove alternate skeleton definitions from ui-enhancements.css, homepage-v6.css

### #20: outline:focus-visible replacement
- Find remaining `outline: none` without `:focus-visible` counterpart
- Verified: most sites already have paired rules. Only `referral.css:280` needs fix.
- Add `:focus-visible { outline: 2px solid var(--aura-chrome-mid); outline-offset: 2px; }`

## Architecture

```
CSS Layer Hierarchy (after fixes):
  brand-tokens.css      ← Design tokens + standard components (source of truth)
  global.css            ← Tailwind v4 + project theme (React SPA only)
  homepage-v6.css       ← Core layout only (<1000 lines after split)
  homepage-*.css        ← Extracted modules (hero, sections, nav, footer, responsive)
  page-specific.css     ← Per-page overrides (minimal, no !important)
```

## Related Code Files

- **Modify**: `css/brand-tokens.css`, `css/homepage-v6.css`, `css/menu-v6.css`, `css/ui-enhancements.css`, `css/checkout-styles.css`, `css/track-order-styles.css`, `css/pos.css`, `css/referral.css`, `css/contact.css`, `css/reservations.css`
- **Create**: `css/homepage-hero.css`, `css/homepage-sections.css`, `css/homepage-nav.css`, `css/homepage-footer.css`, `css/homepage-responsive.css`
- **Modify HTML**: `events.html`, `loyalty.html`, `referral.html` (CSS path fixes), `admin/*.html` (Google Fonts CDN), `signup/index.html` (Google Fonts CDN)

## Implementation Steps

1. **Test capture**: Run `npm test` → baseline (expect 60 pre-existing failures). Capture `grep -c '!important' css/*.css` = 212.
2. **Fix #2**: Fix 3 real dead CSS link paths (../css/ prefix)
3. **Fix #14**: Remove Google Fonts CDN from 8+ admin pages + signup/index.html
4. **Fix #16**: Dedupe 12 keyframes → brand-tokens.css, remove from other files
5. **Fix #20**: Fix remaining outline:none without focus-visible (referral.css:280)
6. **Fix #12**: Backdrop-filter cleanup
7. **Fix #17**: Standardize toasts → .aura-toast in brand-tokens.css
8. **Fix #18**: Consolidate skeletons → animate-shimmer
9. **Fix #8**: Font alignment — use CSS vars everywhere
10. **Fix #11**: Button standardization — .aura-btn-* system
11. **Fix #3**: Split homepage-v6.css into 5 modules
12. **Verify**: Re-run `npm test` → no NEW failures. E2E overflow tests pass.

## Success Criteria

- [ ] No NEW `npm test` failures beyond 60 pre-existing baseline
- [ ] E2E overflow tests pass (all pages)
- [ ] No 404 CSS links in browser console
- [ ] `!important` count <80 (from 212 baseline)
- [ ] homepage-v6.css <1000 lines
- [ ] `npm run build` passes with 0 errors

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| homepage-v6.css split breaks static pages | Test each extracted module loads; verify all static pages render correctly |
| Removing !important breaks specificity | Test each removal; keep reduced-motion/print/utility !important |
| Font alignment changes appearance | Visual diff screenshots before/after |
| Button class rename breaks JS selectors | Grep for `.btn-` in JS files before renaming |
