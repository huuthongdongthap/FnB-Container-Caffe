---
phase: 4
title: "Token Migration"
status: completed
priority: P3
dependencies: []
---

# Phase 4: Token Migration

## Overview

Replace 60+ hardcoded hex colors in Stitch components with AURA CAFE design system CSS custom properties. This enables theming, dark mode switching, and consistent visual identity.

## Requirements

- **Functional:** Replace all hardcoded hex colors in 5 core component files
- **Functional:** Replace inline font-family references with Tailwind classes
- **Non-functional:** No new hardcoded brand colors in Stitch components

## Related Code Files

| File | Issue | Fix Pattern |
|------|-------|-------------|
| `StitchMenuGrid.tsx` | 11x `#b8c7e2`, 2x `#e4e2e4` | → `text-[var(--aura-chrome-light)]`, `text-[var(--aura-text-primary)]` |
| `StitchZones.tsx` | 5x `#b8c7e2`, `#0e0e10`, `#e0e0e0` | → `--aura-chrome-light`, `--aura-bg-surface`, `--aura-text-secondary` |
| `StitchStats.tsx` | `#0A1A2E`, `#b8c7e2` | → `var(--aura-bg-page)`, `var(--aura-chrome-light)` |
| `StitchTestimonials.tsx` | `#b8c7e2`, `#e4e2e4` | → `--aura-chrome-light`, `--aura-text-primary` |
| `StitchLocation.tsx` | `#b8c7e2`, `#c5c6cd`, `#0A1A2E` | → `--aura-chrome-light`, `--aura-text-body`, `--aura-bg-page` |

## Implementation Steps

### Step 1: Create color mapping reference

```ts
const COLOR_MAP: Record<string, string> = {
  '#b8c7e2': '--aura-chrome-light',
  '#e4e2e4': '--aura-text-primary',
  '#e8e8e8': '--aura-text-primary',
  '#c5c6cd': '--aura-text-body',
  '#44474d': '--aura-border-soft',
  '#0A1A2E': '--aura-bg-page',
  '#0e0e10': '--aura-bg-surface',
  '#1b1b1d': '--aura-bg-surface',
  '#2a2a2d': '--aura-bg-elevated',
  '#a0a0a0': '--aura-text-secondary',
  '#c0c0c0': '--aura-chrome-light',
  '#e0e0e0': '--aura-chrome-mid',
  '#343536': '--aura-border-subtle',
};
```

### Step 2: Per-file migration

For each file, replace:
- Hardcoded hex `#b8c7e2` → Tailwind `text-[var(--aura-chrome-light)]` or inline `var(--aura-chrome-light)`
- Hardcoded hex `#e4e2e4` → `text-[var(--aura-text-primary)]`
- Hardcoded hex `#44474d` → `var(--aura-border-soft)`
- Hardcoded hex `#0A1A2E` → `var(--aura-bg-page)`

### Step 3: Font-family fix

Replace:
```tsx
style={{ fontFamily: "'Space Grotesk', ..." }}
```
With Tailwind utility class:
```tsx
className="font-body"
```

## Success Criteria

- [ ] StitchMenuGrid.tsx: 0 hardcoded brand colors (use CSS vars)
- [ ] StitchZones.tsx: 0 hardcoded brand colors
- [ ] StitchStats.tsx: 0 hardcoded brand colors
- [ ] StitchTestimonials.tsx: 0 hardcoded brand colors
- [ ] StitchLocation.tsx: 0 hardcoded brand colors
- [ ] All font-family inline styles replaced with `font-body`/`font-display` classes
- [ ] Build passes with 0 errors
