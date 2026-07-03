---
phase: 8
title: "C2: Convert Images + Update Refs"
status: pending
priority: P2
effort: 1h
mode: default
stream: C
---

# Phase C2: Convert Images + Update Refs

## Overview

Update all `.png` references in codebase to `.webp`.

## Requirements

- Update all `.png` refs in `src/` to `.webp`
- Update CSS `background-image` refs
- Update inline style image refs
- Update docs

## Related Code Files

- Modify: `src/**/*.tsx`, `src/**/*.css`
- Modify: `docs/*.md`, `README.md`

## Implementation Steps

1. Grep for `.png` in `src/` and `docs/`
2. Replace `.png` → `.webp`
3. Verify images load in dev server
4. `npm run build`

## Success Criteria

- [ ] All `.png` refs in `src/` → `.webp`
- [ ] CSS background-image refs updated
- [ ] All images render correctly
- [ ] `npm run build` — 0 errors
