---
phase: 2
title: "P1b: KDS Component"
status: pending
priority: P1
effort: 45m
---

# Phase 2: StitchKDS Component

## Overview

Convert `stitch-exports/kds/design.html` → `src/components/stitch/StitchKDS.tsx`. Kitchen Display with order ticket grid, countdown timers, status badges.

## Related Code Files

- Source: `stitch-exports/kds/design.html`
- Create: `src/components/stitch/StitchKDS.tsx`
- Modify: `src/components/stitch/index.ts`

## Implementation Steps

1. Read source HTML + existing KDS pattern
2. Create StitchKDS.tsx — order grid, ticket cards
3. Glass panel, badges, timer, complete button
4. Lucide icons (Bell, Clock, Check)
5. Responsive grid
6. Export + build

## Success Criteria

- [ ] Ticket grid renders glass cards
- [ ] Table, items, timer per ticket
- [ ] Status badges with correct colors
- [ ] Complete button chrome gradient
- [ ] npm run build — 0 errors
