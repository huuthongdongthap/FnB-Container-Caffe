# AURA CAFE — Frontend Design Polish Report

**Date:** 2026-07-03
**Scope:** Visual consistency audit of `src/` against `DESIGN.md`
**Platform:** React + Tailwind v4 + Vite

---

## Summary of Findings

AUDIT of 97 components + 26 pages against DESIGN.md (Industrial Luxury / Chrome-Silver / Glassmorphism).

Three high-impact polish opportunities identified below, ordered by visibility to the end user.

---

## 1. Base Card/Glass Component Inconsistency

**Files:**
- `/Users/macbook/FnB-Container-Caffe/src/components/ui/card.tsx`
- `/Users/macbook/FnB-Container-Caffe/src/components/ui/drawer.tsx`

**Current problem:** The base `Card` uses `bg-white/80 backdrop-blur-sm` — a light-mode background token in a dark-themed app. Each consumer overrides it inline with different background values:
- Loyalty pages: override with page-level `bg-[#0A1A2E]` and `border-border` classes
- Menu cards: `bg-white/[0.03] backdrop-blur-md border border-white/[0.08]`
- Checkout summary: `rounded-xl border border-chrome-light/10 bg-[#0A1A2E]/50`
- Home stats: `bg-white/5 backdrop-blur-sm`

This creates 4+ distinct card visual styles when DESIGN.md defines exactly one glass card spec.

**DESIGN.md spec (from `components.glass-card`):**
```yaml
background: "rgba(255,255,255,0.03)"
border: "1px solid rgba(255,255,255,0.08)"
backdrop-filter: "blur(12px)"
rounded: lg (16px)
padding: 20px
hover:
  border: "1px solid rgba(198,198,199,0.3)"
  transform: "scale(1.01)"
```

**Fix — update Card to be the canonical glass card:**

Replace `/Users/macbook/FnB-Container-Caffe/src/components/ui/card.tsx`:

```tsx
export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-white/[0.03] backdrop-blur-md',
        'border-white/[0.08]',
        'transition-all duration-300 ease-out',
        'hover:border-white/20 hover:scale-[1.01] hover:shadow-[0_0_30px_rgba(201,214,223,0.12)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
```

Then remove inline overrides from consumer pages (loyalty, checkout, featured-menu). The hover shadow should use `--aura-glow-chrome` via a class like `hover:shadow-[var(--aura-glow-chrome)]` for token consistency.

**Drawer issue:** `/Users/macbook/FnB-Container-Caffe/src/components/ui/drawer.tsx` should also adopt glass styling for its panel (dark semi-transparent background, blur, chrome border).

---

## 2. Checkout Form — Dark Theme Breakage

**Files:**
- `/Users/macbook/FnB-Container-Caffe/src/components/order/checkout-form.tsx`
- `/Users/macbook/FnB-Container-Caffe/src/pages/checkout.tsx`

**Current problem:** The checkout form uses light-mode input fields (`bg-white`) and card containers (`bg-background/50` resolves to `#F5F0EB` beige from Tailwind `@theme`). This creates a jarring light island in the dark navy page. DESIGN.md explicitly states: "Never use pure white (#FFFFFF) for backgrounds — always use tinted surface colors".

Specific violations in `checkout-form.tsx`:
- Line 162: `className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-base"` — white input background
- Line 185: `className="... bg-background/50 p-6"` — `bg-background` resolves to `#F5F0EB` (Tailwind light beige)
- Line 134-156: Delivery time buttons use hardcoded `border-accent-warm` (bronze) — DESIGN.md says bronze is for highlights only, not main interaction
- Emoji icons (line 140, 153) violate the "use SVG/Lucide icons" rule

**Fix:**

```tsx
// Replace bg-white with dark glass inputs per DESIGN.md input-field spec
// Before (line 162):
className="flex-1 rounded-lg border border-border bg-white px-4 py-2.5 ..."

// After — use DESIGN.md input-field tokens:
className="flex-1 rounded-lg border border-white/[0.1] bg-white/[0.05] px-4 py-2.5
           text-[#e8e8e8] placeholder:text-[#a0a8b0]
           backdrop-blur-sm focus:border-[#c6c6c7] focus:shadow-[0_0_0_2px_rgba(198,198,199,0.15)]
           transition-all duration-200"

// Fix delivery time buttons — use chrome accent, not bronze:
// Before (line 136):
'border-accent-warm bg-accent-warm/5'

// After — use chrome per DESIGN.md:
'border-[#c6c6c7] bg-[#c6c6c7]/10 shadow-[0_0_20px_rgba(198,198,199,0.15)]'

// Fix the summary card (line 201):
// Before:
'rounded-xl border border-border/20 bg-background/50 p-6'

// After:
'rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-6'
```

**Input component** (`/Users/macbook/FnB-Container-Caffe/src/components/ui/input.tsx`) should also be checked — it may expose the same light-theme defaults.

---

## 3. Loyalty Page — Emoji Icons & Hardcoded Fonts

**Files:**
- `/Users/macbook/FnB-Container-Caffe/src/pages/loyalty.tsx`
- `/Users/macbook/FnB-Container-Caffe/src/components/loyalty/tier-card.tsx`
- `/Users/macbook/FnB-Container-Caffe/src/components/loyalty/tier-progress.tsx`

**Current problem:** The loyalty system uses emoji characters for icons (tier icons, section cards) and hardcodes `font-[EB_Garamond,serif]` instead of the `--aura-font-display` CSS variable. DESIGN.md says: "Don't use emoji for icons — use SVG or Lucide icons".

Specific violatons:

**loyalty.tsx:**
- Line 83: `font-[EB_Garamond,serif]` — should be a utility class referencing `--aura-font-display`
- Line 86: `bg-gradient-to-r from-accent to-accent-warm` — bronze/warm gradient instead of chrome
- Lines 156-162, 165-172, 175-182, 185-192: emoji icons (`&#9749;`, `&#128591;`, `&#127874;`, `&#128279;`) — should be Lucide SVGs
- Lines 97, 103: Buttons use hardcoded `bg-[#b8c7e2]` instead of `aura-btn-silver`

**tier-card.tsx:**
- Line 62: `{TIER_ICONS[tier] || '\u{1F305}'}` — emoji icons instead of SVG icons
- Lines 65, 71: Hardcoded `text-foreground` instead of chrome-colored text

**Fix — Loyalty Page:**

```tsx
// Replace hardcoded font (line 83):
// Before:
<h1 className="mb-4 font-[EB_Garamond,serif] text-4xl font-bold md:text-5xl">

// After — use CSS variable via Tailwind arbitrary:
<h1 className="mb-4 font-display text-4xl font-bold md:text-5xl">

// Replace emoji icons with Lucide SVGs in how-to-earn cards:
// Import at top:
import { Coffee, MapPin, Gift, Share2 } from 'lucide-react';

// Replace each emoji span with:
// Before: <span className="mb-3 block text-3xl">&#9749;</span>
// After:
<Coffee className="mx-auto mb-3 h-8 w-8 text-[#c6c6c7]" />

// Fix section gradient (line 141):
// Before: bg-gradient-to-b from-muted/5 to-transparent
// After: bg-gradient-to-b from-chrome-light/5 to-transparent
```

**Fix — TierCard (tier-card.tsx):**

Replace emoji with inline Lucide icons or a simple diamond/star SVG:

```tsx
import { Award, Star, Trophy, Diamond } from 'lucide-react';

const TIER_ICONS: Record<string, React.ReactNode> = {
  bronze: <Award className="h-8 w-8 text-amber-700" />,
  silver: <Star className="h-8 w-8 text-slate-300" />,
  gold: <Trophy className="h-8 w-8 text-yellow-500" />,
  platinum: <Diamond className="h-8 w-8 text-cyan-300" />,
};
```

Fix featured tier badge colors — use chrome gradient borders instead of bronze:

```tsx
// Line 42: for gold featured card:
// Before:
'tier-card--featured border-accent/40 shadow-[0_0_30px_rgba(107,159,184,0.1)]'

// After — use chrome accent per DESIGN.md:
'tier-card--featured border-[#c6c6c7]/40 shadow-[0_0_30px_rgba(198,198,199,0.12)]'
```

---

## Cross-Cutting Issues (All 3 Candidates)

### Glassmorphism Consistency

Create a shared glass card token set in `global.css` and centralize in the Card component rather than inlining. Current code has 6 different `backdrop-filter` / `background` / `border` combinations:

```css
/* Add to brand-tokens.css to unify all glass surfaces */
:root {
  --aura-glass-bg: rgba(255, 255, 255, 0.03);
  --aura-glass-border: rgba(255, 255, 255, 0.08);
  --aura-glass-hover-border: rgba(198, 198, 199, 0.3);
  --aura-glass-blur: 12px;
}
```

Then update all consumers to reference these tokens.

### Chrome Accent Application

DESIGN.md primary is `#c6c6c7` (chrome/silver). Current code uses a mix:
- `text-accent` = `#C9D6DF` (close but different hue)
- `text-chrome-bright` = `#E8EEF3`
- `text-[#b8c7e2]` = hardcoded, close to chrome but not the DESIGN.md primary

Standardize on `#c6c6c7` as the canonical chrome accent and map Tailwind `text-accent` / `text-chrome-light` / `text-chrome-bright` consistently.

### Responsive Micro-Interactions

Missing from all three candidates:
- **Touch targets:** Buttons should be min 48px height (DESIGN.md spec for all interactive elements). Checkout form buttons and category filter tabs need audit.
- **Add-to-cart feedback:** Menu card has no loading or success animation when adding to cart. Add a brief scale pop + check icon transition.
- **Page transitions:** No entrance animation on route change. Add the `page-entering` class from global.css (`fnb-page-in` keyframe).
- **Skeleton refinement:** `MenuSkeleton` in `menu-grid.tsx` uses `animate-shimmer` but the shimmer background doesn't match card glass styling — use `bg-gradient-to-r from-white/[0.03] via-white/[0.06] to-white/[0.03]` for a glass-like shimmer.

### Animation Additions

```css
/* Add to menu-card hover — chrome shine sweep */
@keyframes chrome-sweep {
  0% { background-position: -100% 0; }
  100% { background-position: 200% 0; }
}

.menu-card-shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg, transparent 0%, rgba(198,198,199,0.04) 50%, transparent 100%
  );
  background-size: 200% 100%;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s;
}
.menu-card:hover .menu-card-shine {
  opacity: 1;
  animation: chrome-sweep 0.6s ease-out;
}
```

### Reduced Motion

All three candidates correctly use the `prefers-reduced-motion: reduce` block already defined in `global.css`, but should verify that `MenuSkeleton` shimmer respects it (it doesn't have explicit overrides — the global `all` rule should cover it).

---

## Priority Order

1. **Card component fix** — highest impact, touches every page
2. **Checkout form dark theme** — conversion-critical flow, high user visibility
3. **Loyalty page icons/fonts** — polish pass, lower functional impact but customer-facing
