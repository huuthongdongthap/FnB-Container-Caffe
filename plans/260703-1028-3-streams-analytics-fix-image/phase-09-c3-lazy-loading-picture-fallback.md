---
phase: 9
title: "C3: Lazy Loading + Picture Fallback"
status: pending
priority: P2
effort: 0.5h
mode: default
stream: C
---

# Phase C3: Lazy Loading + Picture Fallback

## Overview

Add lazy loading + WebP/PNG picture fallback for all images.

## Requirements

- `loading="lazy"` on all `<img>` elements
- `<picture>` with WebP source + PNG fallback
- Reusable `<AuraImage>` component

## Related Code Files

- Create: `src/components/ui/AuraImage.tsx`
- Modify: `src/**/*.tsx` (replace `<img>` with `<AuraImage>`)

## Implementation Steps

1. Create `<AuraImage>` — `picture` wrapper with WebP source + PNG fallback + lazy loading
2. Find all `<img>` in production code → replace with `<AuraImage>`
3. Verify lazy loading in browser dev tools

## Success Criteria

- [ ] `<AuraImage>` created with WebP/PNG fallback
- [ ] All `<img>` have `loading="lazy"`
- [ ] Images lazy-load correctly
- [ ] `npm run build` — 0 errors
- [ ] All existing tests pass
