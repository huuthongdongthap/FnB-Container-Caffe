---
phase: 5
title: "B2: Emoji→SVG Migration + Font Unification"
status: pending
priority: P1
effort: 1h
mode: default
stream: B
---

# Phase B2: Emoji→SVG Migration + Font Unification

## Overview

Fix 2 critical UX findings: 30+ emoji-as-icons → Lucide SVGs, and font family consolidation.

## Requirements

- Replace ALL emoji in UI with Lucide React icons
- Unify fonts: Cormorant Garamond (headings) + Space Grotesk (body)
- Remove Plus Jakarta Sans references (merge into Space Grotesk)
- Use clsx + Lucide consistently

## Related Code Files

- Modify: `src/pages/home.tsx`, `menu.tsx`, `loyalty.tsx`, `promotions.tsx`, `referral.tsx`, `events.tsx`, `reviews*`
- Modify: `src/components/*` (scan all)
- Modify: `src/styles/brand-tokens.css` (audit font declarations)

## Implementation Steps

1. Grep for emoji unicode ranges in all `src/**/*.tsx`
2. Replace each emoji with appropriate Lucide icon
3. Audit font-family in `brand-tokens.css` — transition Plus Jakarta Sans → Space Grotesk
4. `npm run build`

## Success Criteria

- [ ] Zero emoji in production UI code
- [ ] All headings use Cormorant Garamond
- [ ] All body text uses Space Grotesk
- [ ] Plus Jakarta Sans removed from production use
- [ ] `npm run build` — 0 errors
- [ ] All existing tests pass
