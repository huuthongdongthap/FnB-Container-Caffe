---
phase: 4
title: "HelmetHead + i18n Gaps"
status: completed
priority: P2
dependencies: []
---

# Phase 4: HelmetHead + i18n Gaps

## Overview

Audit and fix the remaining HelmetHead SEO gaps (8 pages missing) and i18n completeness across all pages. Most pages (49 of 57) already have HelmetHead. Most i18n namespaces are populated. This phase closes the gaps.

## HelmetHead Audit

### Pages Missing HelmetHead (8)

| Page | File | Action |
|------|------|--------|
| About Us | `src/pages/AboutUs.tsx` | Add HelmetHead with bilingual title + description |
| Brand Guideline | `src/pages/BrandGuideline.tsx` | Add HelmetHead |
| KDS | `src/pages/KDS.tsx` | Add HelmetHead (Kitchen Display has no SEO value but needs title) |
| NotFound | `src/pages/NotFound.tsx` | Add HelmetHead with 404 title |
| Loyalty | `src/pages/loyalty.tsx` | Add HelmetHead |
| Order Success | `src/pages/order-success.tsx` | Add HelmetHead |
| Referral | `src/pages/referral.tsx` | Add HelmetHead |
| Account | `src/pages/account/index.tsx` | Add HelmetHead |

### Pattern for HelmetHead

Follow existing pattern from pages that have it:

```tsx
import { HelmetHead } from '@/components/seo/HelmetHead';

// In component:
<HelmetHead
  title="Page Name - AURA CAFE"
  description="Page description in English. Mo ta bang tieng Viet."
/>
```

## i18n Audit

- Check that all UI text across all pages has corresponding i18n keys
- Verify both `src/locales/en.json` and `src/locales/vi.json` are populated
- Focus on pages that were recently migrated or had low coverage:
  - Stitch components with new i18n namespaces (from quality pass)
  - Pages mentioned above that lack HelmetHead (may also lack i18n)

## Implementation Steps

### Step 1: HelmetHead pass (45 min)
- Add HelmetHead to each of the 8 missing pages
- Use bilingual title + description pattern
- Follow existing HelmetHead imports from adjacent pages

### Step 2: i18n spot-check (30 min)
- Run `npm test` to ensure i18n validation tests pass
- Check `src/locales/en.json` and `src/locales/vi.json` for completeness
- Add any missing keys found during review

### Step 3: Verify (15 min)
- `npm run build` - 0 TypeScript errors
- `npm test` - all 1,091 tests passing

## Related Code Files

- Modify: `src/pages/AboutUs.tsx` (add HelmetHead)
- Modify: `src/pages/BrandGuideline.tsx` (add HelmetHead)
- Modify: `src/pages/KDS.tsx` (add HelmetHead)
- Modify: `src/pages/NotFound.tsx` (add HelmetHead)
- Modify: `src/pages/loyalty.tsx` (add HelmetHead)
- Modify: `src/pages/order-success.tsx` (add HelmetHead)
- Modify: `src/pages/referral.tsx` (add HelmetHead)
- Modify: `src/pages/account/index.tsx` (add HelmetHead)
- Read: `src/components/seo/HelmetHead.tsx` (reference for API)
- Read: existing pages with HelmetHead (pattern reference)

## Success Criteria

- [ ] All 8 pages with missing HelmetHead now have it
- [ ] All HelmetHead entries have bilingual (VN + EN) content
- [ ] `npm run build` - 0 TypeScript errors
- [ ] `npm test` - 1,091 tests passing
- [ ] i18n validation tests pass (no missing keys)

## Risk Assessment

- Low risk - HelmetHead additions are purely additive
- The i18n validation test (`tests/i18n-bilingual.test.ts:47`) checks locale file parity - run this first to baseline
- No route or behavior changes
