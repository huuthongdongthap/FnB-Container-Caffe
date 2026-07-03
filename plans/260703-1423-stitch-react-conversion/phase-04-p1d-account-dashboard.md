---
phase: 4
title: "P1d: Account Dashboard"
status: pending
priority: P1
effort: 45m
---

# Phase 4: StitchAccountDashboard Component

## Overview

Convert `stitch-exports/account/design.html` → `src/components/stitch/StitchAccountDashboard.tsx`. Mobile-first customer account.

## Related Code Files

- Source: `stitch-exports/account/design.html`
- Create: `src/components/stitch/StitchAccountDashboard.tsx`
- Modify: `src/components/stitch/index.ts`

## Implementation Steps

1. Read source HTML (mobile)
2. Create component — mobile-first
3. Profile header glass card
4. Order history with status badges
5. Loyalty points + tier progress
6. Subscription plan section
7. Quick order chrome button
8. Export + build

## Success Criteria

- [ ] Mobile-first responsive
- [ ] Profile header glass card
- [ ] Order history with badges
- [ ] 48px touch targets
- [ ] npm run build — 0 errors
