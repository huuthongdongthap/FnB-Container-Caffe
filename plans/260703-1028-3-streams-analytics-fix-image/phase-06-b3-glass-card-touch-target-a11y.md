---
phase: 6
title: "B3: Glass Card Unification + Touch Targets + A11y"
status: pending
priority: P1
effort: 1h
mode: default
stream: B
---

# Phase B3: Glass Card Unification + Touch Targets + A11y

## Overview

Unify 4+ glass card styles to single DESIGN.md spec, fix touch targets, verify a11y.

## Requirements

- Single `.glass-panel` pattern from DESIGN.md
- All interactive elements → min 48px touch target
- Consistent focus-visible ring (2px chrome, 2px offset)
- WCAG AA contrast on all text/background

## Related Code Files

- Create/Modify: `src/styles/global.css` (unified `.glass-panel` class)
- Modify: `src/components/menu/menu-card.tsx`, `menu-grid.tsx`
- Modify: `src/components/home/*`, `reviews/*`
- Modify: Multiple button/link components for 48px min-height

## Implementation Steps

1. Add unified `.glass-panel` class to `global.css` or `stitch-tokens.css`
2. Audit all cards → update to use unified class
3. Audit interactive elements → add `min-h-[48px]`
4. Verify focus-visible ring consistent
5. Check contrast on glass backgrounds (bump font-weight if needed)
6. `npm test` + `npm run build`

## Success Criteria

- [ ] All glass cards use same CSS class
- [ ] Hover effect matches DESIGN.md
- [ ] All buttons/links ≥ 48px touch target
- [ ] Focus-visible ring present on all interactive elements
- [ ] WCAG AA contrast verified
- [ ] `npm run build` — 0 errors
- [ ] All existing tests pass
