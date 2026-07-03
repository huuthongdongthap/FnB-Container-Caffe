# AURA CAFE — UI Styling Audit Report

**Date:** 2026-07-03
**Scope:** Tailwind CSS v4 @theme, dark mode, responsive breakpoints, glassmorphism, animation/transition
**Design Authority:** /Users/macbook/FnB-Container-Caffe/DESIGN.md
**Source Files:** /Users/macbook/FnB-Container-Caffe/src/styles/global.css, brand-tokens.css
**shadcn/ui Status:** NOT used. Custom components via clsx `cn()` helper (no tailwind-merge). No Radix UI primitives.

---

## A. Tailwind v4 @theme Configuration vs DESIGN.md

### Problem

The `@theme` block in `src/styles/global.css` defines a **light-mode** palette (background #F5F0EB, foreground #0A1628) while DESIGN.md mandates a **dark-mode-only** aesthetic (navy backgrounds, chrome/silver text).

```css
/* global.css @theme — MISALIGNED with DESIGN.md */
@theme {
  --color-background: #F5F0EB;     /* DESIGN.md: #0A1A2E */
  --color-foreground: #0A1628;     /* DESIGN.md: #e8e8e8 */
  --color-primary: #0A1628;        /* DESIGN.md: #c6c6c7 */
  --color-accent: #C9D6DF;         /* DESIGN.md: primary is #c6c6c7 */
}
```

Most TSX components bypass the @theme tokens entirely, using `var(--aura-*)` CSS custom properties from `brand-tokens.css` directly in className strings (e.g., `text-[var(--aura-text-body)]`, `bg-[var(--aura-noir-deep)]`). This means the @theme block is mostly decorative — component styles are not benefiting from Tailwind utility classes that should map to design tokens.

### Recommended Fix

Rewrite the @theme block to match DESIGN.md dark-mode tokens and remove reliance on inline CSS var() in components:

```css
@theme {
  /* DESIGN.md dark-mode base */
  --color-surface-dim: #050D1A;
  --color-surface: #0A1A2E;        /* was --color-background */
  --color-surface-bright: #1a2d42;
  --color-surface-container: #162a3d;
  --color-primary: #c6c6c7;        /* Chrome/silver — main accent */
  --color-primary-container: #e2e2e2;
  --color-on-primary: #1a1a2e;
  --color-secondary: #4a6fa5;
  --color-tertiary: #d4a574;       /* Warm bronze */
  --color-on-surface: #e8e8e8;     /* was --color-foreground */
  --color-on-surface-variant: #a0a8b0;
  --color-outline: #2a3f55;
  --color-destructive: #ffb4ab;
  --color-chrome-bright: #E8EEF3;  /* Direct chrome palette */
  --color-chrome-light: #C9D6DF;
  --color-chrome-mid: #6B9FB8;
  --color-chrome-dark: #3A6B80;
  --font-display: 'Cormorant Garamond', serif;
  --font-body: 'Space Grotesk', sans-serif;
}
```

Remove all `var(--aura-chrome-*)`, `var(--aura-noir-*)`, `var(--aura-text-*)`, `var(--aura-border-*)` references from TSX className strings and use the semantic Tailwind utility classes instead (e.g., `text-primary`, `text-on-surface`, `bg-surface`, `border-outline`).

---

## B. Dark Mode Consistency

### Problem

Only `brand-tokens.css` defines a `[data-theme="dark"]` selector, and there is **no theme toggle logic** in the application code. The default CSS layer (root `:root`) has two conflicting sets of tokens: one light-mode-oriented and one dark-mode-oriented.

Critical UI components use `bg-white` which contradicts DESIGN.md's "Never use pure white (#FFFFFF)" rule:

| File | Line | Current | Should Be |
|------|------|---------|-----------|
| `src/components/ui/card.tsx` | 16 | `bg-white/80 backdrop-blur-sm` | `bg-surface backdrop-blur-lg` |
| `src/components/ui/input.tsx` | 26 | `bg-white` | `bg-surface-container` |
| `src/components/ui/drawer.tsx` | 29 | `bg-white shadow-xl` | `bg-surface-dim shadow-xl` |
| `src/components/ui/modal.tsx` | 40 | `bg-white p-0 shadow-xl` | `bg-surface p-0 shadow-xl` |
| `src/components/ui/badge.tsx` | 13-16 | `bg-green-100 text-green-800` etc | Use surface/primary tokens |
| `src/components/order/delivery-info.tsx` | 106 | `bg-white` | `bg-surface` |
| `src/components/order/checkout-form.tsx` | 161,185 | `bg-white` | `bg-surface` |

The admin pages (BroadcastPage.tsx, etc.) use `dark:` Tailwind variants mixed with `bg-white` light defaults, creating an inconsistent hybrid approach.

**Duplicate Hero Section:** `/src/components/home/` contains TWO hero section files:
- `HeroSection.tsx` (used by `src/pages/home.tsx`) — inline hex colors, CSS var references
- `hero-section.tsx` (used by tests) — uses brand-tokens utility classes like `bg-chrome-mid/10`, `text-chrome-bright`

These have diverged — only one should remain.

### Recommended Fix

1. Consolidate to a single `[data-theme="dark"]`-only mode. Remove the light/default tokens entirely and set dark as the only theme.
2. Replace all `bg-white` in UI components with the appropriate `bg-surface*` token.
3. Remove duplicate HeroSection — keep `hero-section.tsx` (uses brand-token utility classes like `text-chrome-bright`) and delete `HeroSection.tsx` (or vice versa after verifying which has the test).

---

## C. Responsive Breakpoint Verification

### Problem

DESIGN.md specifies:
- **Mobile:** 320px-767px, single column
- **Tablet:** 768px-1023px, 2-column grids
- **Desktop:** 1024px+

The @theme does not customize breakpoints. Tailwind v4 defaults:
- `sm:` = 640px (DESIGN.md wants 768px for tablet)
- `md:` = 768px (correct for tablet start)
- `lg:` = 1024px (correct for desktop start)
- `xl:` = 1280px

No breakpoint exists for the 320-639px mobile range. DESIGN.md requires 320px support.

**Dual responsive system:** Some components use Tailwind responsive classes (`sm:grid-cols-2`, `md:flex`, `lg:grid-cols-3`) while others use raw CSS media queries:

```css
/* brand-tokens.css line 1384 — RAW media query */
@media (max-width: 1024px) { .hero-visual-panel { ... } }
@media (max-width: 768px)  { .hero-visual-panel { ... } }
@media (max-width: 640px)  { .hero-shape { display: none; } }
```

This creates two sources of truth for responsiveness. The CSS media queries in `brand-tokens.css` use `max-width` (desktop-first) while Tailwind classes use `min-width` (mobile-first).

### Recommended Fix

Add custom breakpoints to @theme matching DESIGN.md:

```css
@theme {
  --breakpoint-sm: 320px;    /* Mobile start (matches DESIGN.md spec) */
  --breakpoint-md: 768px;    /* Tablet */
  --breakpoint-lg: 1024px;   /* Desktop */
  --breakpoint-xl: 1440px;   /* Wide */
}
```

Migrate all CSS media queries in `brand-tokens.css` to Tailwind responsive classes or keep a single consistent pattern (mobile-first min-width).

---

## D. Glassmorphism Implementation Quality

### Problem

The DESIGN.md glass card specification is:
```yaml
glass-card:
  background: "rgba(255,255,255,0.03)"
  border: "1px solid rgba(255,255,255,0.08)"
  backdrop-filter: "blur(12px)"
  rounded: lg    # 16px
```

There are **at least 7 different glass implementations** in the codebase:

| Location | Background | Blur | Border |
|----------|-----------|------|--------|
| DESIGN.md spec | `rgba(255,255,255,0.03)` | `blur(12px)` | `rgba(255,255,255,0.08)` |
| `.glass-card` class (brand-tokens.css:651) | `var(--glass-bg)` = `rgba(10,26,46,0.65)` | `blur(16px)` | `var(--glass-border)` = `rgba(201,214,223,0.18)` |
| `.fnb-badge` class (brand-tokens.css:742) | `rgba(255,255,255,0.04)` | `blur(8px)` | `rgba(201,214,223,0.18)` |
| `ui/card.tsx` | `bg-white/80` (white!) | `backdrop-blur-sm` (8px) | `border-border` (#3A6B80) |
| `order-summary-sidebar.tsx` | `bg-[#0A1A2E]/50` | `backdrop-blur-sm` | `border-chrome-light/10` |
| `menu-search.tsx` | `bg-white/[0.03]` | `backdrop-blur-md` (12px) | `border-white/[0.08]` |
| `.menu-card-enhanced` | `var(--glass-bg)` | `blur(12px)` | `var(--glass-border)` |
| `.floating-panel` | `var(--glass-bg)` | `blur(var(--glass-blur))` = 16px | `var(--glass-border)` |

The `-webkit-backdrop-filter` prefix is inconsistently applied — some classes include it, some don't. This affects Safari support.

### Recommended Fix

Create a single canonical Tailwind-compatible glassmorphism utility:

```css
@layer utilities {
  .glass {
    background: rgba(255, 255, 255, 0.03);  /* per DESIGN.md */
    backdrop-filter: blur(12px);              /* per DESIGN.md */
    -webkit-backdrop-filter: blur(12px);      /* Safari compatibility */
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
}
```

Or as a composable class set:
```css
.glass-bg    { background: rgba(255,255,255,0.03); }
.glass-blur  { backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
.glass-border { border: 1px solid rgba(255,255,255,0.08); }
```

Then use `className="glass-bg glass-blur glass-border rounded-lg"`.

Alternatively, define the glass values in @theme:
```css
@theme {
  --glass-bg: rgba(255, 255, 255, 0.03);
  --glass-blur: 12px;
  --glass-border: 1px solid rgba(255, 255, 255, 0.08);
}
```

Consolidate all 7 variants into one consistent approach. Remove `@media (hover: none) { .hero-visual-panel { display:none } }` as it also hides the glass panel on touch devices.

---

## E. Animation / Transition Consistency

### Problem

DESIGN.md defines:
- `duration-fast: 150ms, duration-normal: 250ms, duration-slow: 400ms`
- `easing-default: cubic-bezier(0.4, 0, 0.2, 1)`
- `easing-emphasized: cubic-bezier(0.2, 0, 0, 1)`

brand-tokens.css defines:
- `--aura-duration-fast: 150ms`
- `--aura-duration-base: 300ms` (DESIGN.md says 250ms)
- `--aura-duration-slow: 600ms` (DESIGN.md says 400ms)
- `--aura-ease: cubic-bezier(0.4, 0, 0.2, 1)` (matches)
- `--aura-ease-out: cubic-bezier(0.0, 0, 0.2, 1)` (different from emphasized)

In TSX components, durations are **hardcoded** with no token reference:

| Component | Duration Used |
|-----------|--------------|
| `ui/button.tsx` | `duration-200` |
| `ui/card.tsx` | `duration-200` |
| `ui/navbar.tsx` | `duration-300`, `duration-500`, `duration-200` |
| `ui/drawer.tsx` | `duration-300` |
| `ui/skeleton.tsx` | uses `animate-pulse` (no custom) |
| `order/tip-input.tsx` | `duration-200` |
| `order/delivery-info.tsx` | `duration-150` |
| `order/order-summary-sidebar.tsx` | no transition |
| `home/hero-section.tsx` | `duration-300` |
| `home/five-zone-showcase.tsx` | `duration-300` |
| `menu/MenuCard.tsx` | `duration-700` |
| `kds/StitchLocation.tsx` | `duration-1000` |

The `prefers-reduced-motion` query is defined **twice**: once in the `@layer base` block in `global.css` (lines 52-58) and again in section-specific blocks (lines 843-855, 1531-1546). The duplicate `@media (prefers-reduced-motion: reduce)` blocks should be merged.

### Recommended Fix

Add animation tokens to @theme and use them in components:

```css
@theme {
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-emphasized: cubic-bezier(0.2, 0, 0, 1);
  --animate-fade-in-up: fnb-fade-in-up 0.6s ease-out both;
  --animate-float: fnb-float 7s ease-in-out infinite;
  --animate-glow-pulse: fnb-glow-pulse 3s ease-in-out infinite;
  --animate-scale-pop: fnb-scale-pop 0.5s ease-out both;
}
```

In Tailwind v4, `--animate-*` registers custom animation utilities, so `animate-fade-in-up` would work natively without the CSS class definitions in brand-tokens.css.

Replace hardcoded `duration-200`, `duration-300`, etc. with semantic duration values:

```
duration-200 → duration-fast  (150ms)
duration-300 → duration-normal (250ms)
duration-500 → duration-slow   (400ms)
```

Consolidate all `@media (prefers-reduced-motion: reduce)` blocks into a single location.

---

## F. Quick Wins (No-Regret Changes)

1. **Fix `cn()` utility** — Add `tailwind-merge` to resolve conflicting Tailwind classes:
   ```ts
   import { clsx, type ClassValue } from 'clsx';
   import { twMerge } from 'tailwind-merge';
   export function cn(...inputs: ClassValue[]): string {
     return twMerge(clsx(inputs));
   }
   ```

2. **Remove duplicate HeroSection** — Keep one canonical hero component.

3. **Unify border-radius values** — DESIGN.md specifies `sm: 4px, DEFAULT: 8px, md: 12px, lg: 16px, xl: 24px`. The codebase uses `rounded-lg` (Tailwind default = 8px) and `rounded-xl` (12px). DESIGN.md's `rounded-lg` = 16px, `rounded-xl` = 24px. These map differently. Add to @theme:
   ```css
   @theme {
     --radius-sm: 4px;
     --radius-md: 8px;
     --radius-lg: 16px;
     --radius-xl: 24px;
   }
   ```

4. **Fix semantic colors in Badge component** — Replace hardcoded `bg-green-100`, `bg-amber-100`, `bg-red-100` with DESIGN.md-compatible surface/primary colors.

---

## Summary of Key Files

| File | Status | Action |
|------|--------|--------|
| `src/styles/global.css` | @theme misaligned with DESIGN.md | Rewrite @theme for dark mode |
| `src/styles/brand-tokens.css` | Contains tokens + utility classes + animations | Consolidate into @theme; migrate utility classes |
| `src/lib/cn.ts` | Uses clsx only | Add tailwind-merge |
| `src/components/ui/card.tsx` | bg-white, not dark | Swap to bg-surface |
| `src/components/ui/input.tsx` | bg-white, not dark | Swap to bg-surface-container |
| `src/components/ui/drawer.tsx` | bg-white, not dark | Swap to bg-surface-dim |
| `src/components/ui/modal.tsx` | bg-white, not dark | Swap to bg-surface |
| `src/components/ui/button.tsx` | Uses bg-primary = #0A1628 | Verify against DESIGN.md primary (#c6c6c7) |
| `src/components/ui/badge.tsx` | Hardcoded green/amber/red colors | Use design tokens |
| `src/components/ui/navbar.tsx` | Inline CSS var() references | Migrate to @theme utility classes |
| `src/components/home/HeroSection.tsx` | Duplicate hero | Remove, keep hero-section.tsx |
| `src/components/home/hero-section.tsx` | Dark-mode correct hero | Canonical version |
| `src/pages/home.tsx` | Imports wrong HeroSection | Update import |
