---
phase: 3
title: "P1c: Loyalty Component"
status: pending
priority: P1
effort: 45m
---

# Phase 3: StitchLoyalty Component

## Overview

Convert `stitch-exports/loyalty/design.html` → `src/components/stitch/StitchLoyalty.tsx`. Loyalty program page.

## Related Code Files

- Source: `stitch-exports/loyalty/design.html`
- Create: `src/components/stitch/StitchLoyalty.tsx`
- Modify: `src/components/stitch/index.ts`

## Implementation Steps

1. Read source HTML
2. Create StitchLoyalty.tsx — tier card, progress bar, points
3. Rewards grid glass cards with bronze accent
4. Referral code copy button
5. Points history table chrome headers
6. Check-in tracker
7. Export + build

## Success Criteria

- [ ] Tier card shows current tier + progress
- [ ] Points in large Cormorant Garamond
- [ ] Rewards grid glass cards
- [ ] Referral code copy works
- [ ] npm run build — 0 errors
