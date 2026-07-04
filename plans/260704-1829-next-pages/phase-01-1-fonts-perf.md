---
phase: 1
title: "Fonts + Perf"
status: pending
priority: P1
dependencies: []
---

# Phase 1: Fonts + Perf

## Overview

Fix 2 infrastructure gaps. 2 sub-tasks run in parallel.

## Sub-task 1a: Font Files

**Problem:** brand-tokens.css references 14 woff2 files that don't exist. Build shows 14 font 404 warnings.

**Fix:** Add Google Fonts CDN links in `index.html` and remove local @font-face blocks:

```html
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300..700;1,400&display=swap" rel="stylesheet">
```

Then in `brand-tokens.css`, remove the @font-face `src: url(...)` declarations — the CDN link handles font loading. Keep the `--aura-font-*` CSS custom properties that reference font-family names.

## Sub-task 1b: Code-splitting

**Problem:** Build warns main JS chunk > 1.3MB unminified, >500KB minified.

**Fix:** `React.lazy()` + `Suspense` for admin routes in App.tsx:

```tsx
const AdminDashboardPage = React.lazy(() => import('@/pages/admin/Dashboard'));
const AdminOrdersPage = React.lazy(() => import('@/pages/admin/Orders'));
// ... other admin pages
```

Wrap admin routes: `<Suspense fallback={<Loader />}> ... </Suspense>`

Focus on 15+ admin routes. Customer pages are smaller.

## Files

- Modify: `index.html`
- Modify: `src/styles/brand-tokens.css`
- Modify: `src/App.tsx`

## Success Criteria

- [ ] Google Fonts link tags in index.html
- [ ] brand-tokens.css no longer references missing woff2 files
- [ ] Admin routes use React.lazy() + Suspense
- [ ] No chunk > 500KB (warning resolved)
- [ ] Build + tests pass
