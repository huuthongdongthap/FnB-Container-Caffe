---
phase: 5
title: "P2a: About + Reviews + Events + Referral"
status: pending
priority: P2
effort: 1h
---

# Phase 5: About, Reviews, Events, Referral

## Overview

Convert 4 pages: about, reviews, events, referral.

| Source | Target |
|--------|--------|
| `stitch-exports/about/design.html` | `StitchAbout.tsx` |
| `stitch-exports/reviews/design.html` | `StitchReviews.tsx` |
| `stitch-exports/events/design.html` | `StitchEvents.tsx` |
| `stitch-exports/referral/design.html` | `StitchReferral.tsx` |

## Related Code Files

- Create: 4 component files in `src/components/stitch/`
- Modify: `src/components/stitch/index.ts`

## Implementation Steps

1. Read each source HTML
2. Create each component
3. Map Tailwind → var(--aura-*) tokens
4. Lucide icons
5. Export all
6. npm run build

## Success Criteria

- [ ] 4 components compile
- [ ] Dark navy + chrome styling
- [ ] Responsive
- [ ] npm run build — 0 errors
