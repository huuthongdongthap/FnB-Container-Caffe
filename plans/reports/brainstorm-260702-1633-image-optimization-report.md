---
title: "Image Optimization — Design Report"
date: 2026-07-02
status: approved
mode: text
---

# Image Optimization

**Problem:** 47MB of PNG images slow page loads on mobile data. Cafe customers on 3G/4G wait for large hero/menu images.

**Solution:** Convert PNG→WebP, add lazy loading + responsive images.

## Approach: Option B

1. **Convert** — 47MB PNGs → ~8MB WebP via `sharp` script
2. **Lazy load** — `loading="lazy"` on all non-hero images
3. **Picture fallback** — `<picture><source webp><img png>` for browser compat
4. **Responsive** — `srcset` for menu images

## Scope

**In:** Batch conversion script, code updates for img tags, lazy loading attributes.
**Out:** AVIF conversion, Vite build plugin, CDN image resizing.

## Touchpoints

- All `.html` files referencing images
- React components with `<img>` tags
- CSS `background-image` references
- New: `scripts/optimize-images.mjs`

## Effort: ~2h
