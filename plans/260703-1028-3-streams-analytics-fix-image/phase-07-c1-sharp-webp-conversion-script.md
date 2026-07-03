---
phase: 7
title: "C1: Sharp + WebP Conversion Script"
status: pending
priority: P2
effort: 0.5h
mode: default
stream: C
---

# Phase C1: Sharp + WebP Conversion Script

## Overview

Write batch conversion script to convert 47MB PNGs → WebP.

## Requirements

- `scripts/convert-to-webp.mjs` — iterate `images/`, convert PNGs
- Preserve originals in `images/originals/`
- WebP quality=80
- Skip already-converted files

## Related Code Files

- Create: `scripts/convert-to-webp.mjs`

## Implementation Steps

1. Write script: walk `images/` recursively, convert to WebP with sharp
2. Run: `node scripts/convert-to-webp.mjs`
3. Verify WebP renders in browser

## Success Criteria

- [ ] Script runs successfully
- [ ] All PNGs converted to WebP (quality ≥ 80)
- [ ] Originals preserved in `images/originals/`
- [ ] Total size: 47MB → < 10MB
