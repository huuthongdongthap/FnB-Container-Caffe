---
phase: 4
title: "B1: UI/UX Fix — Card/Input/Drawer Dark Theme"
status: pending
priority: P1
effort: 1h
mode: default
stream: B
---

# Phase B1: UI/UX Fix — Card/Input/Drawer Dark Theme

## Overview

Fix 3 critical component color mismatches: generic UI components render light-mode tokens on dark canvas.

## Requirements (from UX audit)

- `Card.tsx`: `bg-white/80` → `var(--aura-bg-glass)` + glassmorphism tokens
- `Input.tsx`: `bg-white` → `var(--aura-bg-input)` + chrome focus
- `Drawer.tsx`: `bg-white` → `var(--aura-bg-elevated)` + dark shadow
- No hardcoded light colors — reference `stitch-tokens.css` CSS vars

## Related Code Files

- Modify: `src/components/ui/card.tsx`
- Modify: `src/components/ui/input.tsx`
- Modify: `src/components/ui/drawer.tsx`

## Implementation Steps

1. Read each file, identify light-mode color tokens
2. Replace with `var(--aura-*)` equivalents
3. Card: glassmorphism pattern (semi-transparent bg, blur, chrome border)
4. Input: dark bg, chrome focus ring, dark placeholder
5. Drawer: dark elevated surface, proper z-index
6. `npm run build`

## Success Criteria

- [ ] Card renders dark glass (not white) on dark bg
- [ ] Input has dark bg with chrome focus ring
- [ ] Drawer has dark panel
- [ ] No hardcoded light colors
- [ ] `npm run build` — 0 errors
- [ ] All existing tests pass
