# AURA CAFE — Comprehensive UI/UX Pro Max Audit

**Audit Date:** 2026-07-03  
**Auditor:** UI/UX Pro Max  
**Project:** AURA CAFE — Industrial Luxury Container Caffe  
**Design System:** `/Users/macbook/FnB-Container-Caffe/DESIGN.md`  
**Source:** `/Users/macbook/FnB-Container-Caffe/src/`  
**UI/UX Pro Max Intelligence:** `/Users/macbook/ui-ux-pro-max-skill/`

---

## Executive Summary

| Category | Score | Severity |
|---|---|---|
| 1. Color System | **5/10** | HIGH |
| 2. Typography | **3/10** | CRITICAL |
| 3. Layout / Spacing | **7/10** | MEDIUM |
| 4. Accessibility | **6/10** | HIGH |
| 5. UX Patterns | **4/10** | CRITICAL |

**Overall: 5/10 — Needs significant remediation.**

The design system definition (DESIGN.md) sets a strong, cohesive direction. However, the implementation diverges severely in three critical areas: font selection (three different font families in use vs. one spec), emoji-over-SVG violations (30+ instances across every major page), and generic UI components that render light-mode colors on a dark-navy canvas. The result is a fragmented visual experience where the luxury-chrome identity is diluted by inconsistent component styling.

---

## 1. Color System Audit — 5/10

### 1.1 DESIGN.md Spec vs. Implementation

DESIGN.md defines:
- Surface: `#0d1b2a` | Background: `#0A1A2E` | Surface-dim: `#050D1A`
- Primary: `#c6c6c7` (chrome) | On-primary: `#1a1a2e` | On-surface: `#e8e8e8`
- No pure white anywhere.

### 1.2 FINDINGS

**CRITICAL: Tailwind v4 theme is light-mode**

`global.css:14` defines:
```css
@theme {
  --color-background: #F5F0EB;      /* WARM CREAM — light mode */
  --color-foreground: #0A1628;       /* dark */
  --color-primary: #0A1628;          /* dark navy */
  --color-secondary: #1B2D4F;        /* navy */
  --color-accent: #C9D6DF;           /* chrome (only correct one) */
}
```

These light-mode Tailwind tokens propagate to generic UI components. On the dark navy page background (`#0A1A2E`), components render LIGHT backgrounds — a direct violation of the DESIGN.md rule "Never use pure white (#FFFFFF) for backgrounds".

**CRITICAL: White-on-dark inconsistency in generic components:**

| Component | File | Background | Problem |
|---|---|---|---|
| `Card.tsx` | `components/ui/card.tsx:16` | `bg-white/80 backdrop-blur-sm` | Light glass on dark page |
| `Input.tsx` | `components/ui/input.tsx:26` | `bg-white` | Pure white input on dark page |
| `Drawer.tsx` | `components/ui/drawer.tsx:29` | `bg-white shadow-xl` | White drawer panel |
| `Button primary` | `components/ui/button.tsx:14` | `bg-primary text-white` | `#0A1628` on `#0A1A2E` — invisible |
| `Skeleton.tsx` | `components/ui/skeleton.tsx:19` | `bg-muted/30` | Muted is light gray |

**Page-level overrides compensate:** Pages like `checkout.tsx`, `menu.tsx` use custom inline glassmorphism (`bg-[#0A1A2E]/50 backdrop-blur-sm`) — but the generic components remain broken.

**CHROME PALETTE INCONSISTENCY:**

| Source | Chrome Primary | Hex |
|---|---|---|
| DESIGN.md | Chrome/silver | `#c6c6c7` |
| `brand-tokens.css` | Chrome bright/light | `#E8EEF3` / `#C9D6DF` |
| `global.css` @theme | Accent | `#C9D6DF` |
| `hero-section.tsx` | Chrome gradient | `#e8e8e8` → `#b0b0b0` |
| LIVE rendering (CSS var usage) | `--aura-chrome-light` | `#C9D6DF` (used most) |

Three different chrome values in use: `#c6c6c7` (spec), `#C9D6DF` (actual CSS), `#b0b0b0` (hero gradient). Minor shift but consistent enough visually.

**MEDIUM: Forest green tokens unused.** `--aura-forest-*` tokens defined but never referenced in any page/component. Useful for bar-zone theming but currently dead code.

### 1.3 Contrast Ratios

All key text-on-dark combinations pass WCAG AA and AAA:

| Combination | Contrast | Pass? |
|---|---|---|
| `#c6c6c7` on `#0A1A2E` | 10.6:1 | AAA ✅ |
| `#e8e8e8` on `#0A1A2E` | 14.6:1 | AAA ✅ |
| `#a0a8b0` on `#0A1A2E` | 7.5:1 | AAA ✅ |
| `#8A8E96` on `#0A1A2E` | 5.6:1 | AA ✅ |

No contrast issues. The dark navy + chrome palette inherently provides excellent contrast.

### 1.4 Recommendations

1. **Fix Tailwind @theme block** to use dark-mode tokens by default (since AURA is dark-only):
   ```css
   --color-background: #0A1A2E;
   --color-foreground: #e8e8e8;
   --color-primary: #0d1b2a;
   --color-accent: #C9D6DF;
   ```

2. **Rewrite generic components** (Card, Input, Drawer, Button, Skeleton) to use dark-surface colors instead of white backgrounds. Follow the glass-card spec:
   ```css
   /* Card should be */
   background: rgba(255,255,255,0.03);
   border: 1px solid rgba(255,255,255,0.08);
   backdrop-filter: blur(12px);
   ```

3. **Remove `@theme` light-mode colors entirely** — AURA is dark-only as stated in `use-aura-theme.ts:20`.

4. **Document the canonical chrome hex value** in DESIGN.md and enforce one source of truth. Currently `#c6c6c7` (spec) vs `#C9D6DF` (CSS) — pick one.

---

## 2. Typography Audit — 3/10 (CRITICAL)

### 2.1 DESIGN.md Spec

```yaml
font-family:
  display: ["Cormorant Garamond", "Georgia", "serif"]
  body: ["Space Grotesk", "Inter", "sans-serif"]
font-display: Cormorant Garamond (serif) — for H1-H2, hero, pricing
font-body: Space Grotesk (sans) — for all body, labels, buttons
```

### 2.2 FINDINGS

**CRITICAL: Three different font families in use across the app.**

| Font Family | Where Used | Source |
|---|---|---|
| **Plus Jakarta Sans** | ALL body + display text | `brand-tokens.css:161-162` |
| **Cormorant Garamond** | Tailwind theme only | `global.css:24` |
| **EB Garamond** | AboutUs.tsx, Contact.tsx, ReviewsPage.tsx | Inline `font-[EB_Garamond,serif]` |

This is the most severe issue. `brand-tokens.css` sets:
```css
--aura-font-display: 'Plus Jakarta Sans', ...;
--aura-font-body: 'Plus Jakarta Sans', ...;
```
BOTH display and body point to Plus Jakarta Sans — a completely different font than DESIGN.md's Cormorant Garamond + Space Grotesk.

Meanwhile, `global.css` correctly defines:
```css
--font-display: 'Cormorant Garamond', serif;
--font-body: 'Space Grotesk', sans-serif;
```

So Tailwind utility classes (`font-display`, `font-body`) use the correct fonts, but CSS variable references (`var(--aura-font-display)`) use Plus Jakarta Sans. The app switches between two font systems depending on whether a component uses Tailwind classes or CSS custom properties.

On AboutUs, Contact, and ReviewsPage, a third font `EB Garamond` is used inline — yet another serif that's neither Cormorant Garamond nor Plus Jakarta Sans.

### 2.3 Font Size Mismatch

| Level | DESIGN.md | brand-tokens.css | Delta |
|---|---|---|---|
| display-lg | 72px | `clamp(48px, 8vw, 80px)` | Acceptable (responsive) |
| display-md | 48px | `clamp(32px, 5vw, 56px)` | Acceptable |
| headline-lg | 32px | `clamp(28px, 4vw, 42px)` | At spec minimum |
| headline-md | 24px | 20px (`--aura-fs-h3`) | **-4px** |
| body-md | 16px | 16px | Matches ✅ |
| body-sm | 14px | 14px | Matches ✅ |

Headline-md undersized by 4px (20px vs 24px spec).

### 2.4 Recommendations

1. **Consolidate to ONE font stack** — Cormorant Garamond (display) + Space Grotesk (body) as DESIGN.md specifies.
2. **Delete or repurpose Plus Jakarta Sans** — Either remove it entirely or keep only as a utility/fallback font.
3. **Replace all `font-[EB_Garamond,serif]`** instances with `font-display` (Cormorant Garamond).
4. **Fix brand-tokens.css** to match DESIGN.md:
   ```css
   --aura-font-display: 'Cormorant Garamond', Georgia, serif;
   --aura-font-body: 'Space Grotesk', Inter, sans-serif;
   ```
5. **Fix headline-md** from 20px to 24px to match spec.
6. **Add Google Fonts import** — Neither Cormorant Garamond nor Space Grotesk is imported in global.css. Add:
   ```
   @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
   ```

---

## 3. Layout / Spacing Audit — 7/10

### 3.1 DESIGN.md Spec

```yaml
spacing:
  unit: 8px
  container-padding: 24px (desktop), 16px (mobile)
  card-gap: 16px
  section-margin: 48px
  grid-gap: 20px
```

### 3.2 FINDINGS

**GOOD: 8px grid system observed** — Most spacing uses Tailwind's 8px-base scale (`p-4`=16px, `gap-4`=16px, `p-6`=24px, etc.).

**GOOD: Max-width containers consistent** — `max-w-6xl` (72rem = 1152px) approximates the 1200px spec on all pages.

**GOOD: Card grid gaps consistent** — `gap-5` (20px) matches grid-gap spec. MenuGrid uses `gap-5` as specified.

**MEDIUM: Section spacing exceeds spec** — DESIGN.md says `section-margin: 48px`, but pages use:
- Home page stats strip: `py-10` (40px) — slightly under
- FeaturedMenu/FiveZoneShowcase: `py-20` (80px) — **67% over spec**
- AboutUs sections: `py-16` (64px) — 33% over
- ReviewsPage: `py-12` (48px) — matches ✅

**MEDIUM: Container padding inconsistent.** Some pages use `px-4` (16px) on mobile (matches 16px spec), but the DESIGN.md spec for `container-padding` says 24px. Most desktop pages use `px-4` which is 16px, not 24px.

**GOOD: Glassmorphism cards consistent** — Multiple implementations follow the spec:
- `rgba(255,255,255,0.03)` background
- `backdrop-filter: blur(12-16px)`
- `border: rgba(255,255,255,0.08)`
- `rounded-lg` (12-16px)

**ISSUE: Hero text sizing** — HeroSection uses `text-6xl sm:text-7xl md:text-8xl lg:text-9xl` which goes from 60px to 128px. This exceeds the `display-lg: 72px` spec at lg screen sizes (128px is 78% over).

### 3.3 Recommendations

1. Standardize section padding to `py-12` (48px = spec) across all pages.
2. Use `px-6` (24px) for desktop container padding to match spec.
3. Cap hero headline at `lg:text-8xl` (72px) to match display-lg spec.
4. Create a reusable `Section` component that enforces consistent vertical rhythm.

---

## 4. Accessibility Audit — 6/10

### 4.1 Findings

**GOOD: Focus indicators** — `global.css:48` defines `:focus-visible` with `outline: 2px solid var(--color-accent)`. Present on buttons, inputs, and links.

**GOOD: Color contrast** — All text combinations pass WCAG AA (see 1.3). The dark-navy + chrome palette is inherently high-contrast.

**GOOD: Touch targets** — Buttons consistently use 48px height (`py-3` = 12px + text ≈ 24px = ~48px). Icon buttons in cart-item (h-8 w-8 = 32px) are below the 44x44 minimum; however, the `aria-label` compensates.

**MEDIUM: `aria-labels` inconsistent**:
- Navbar hamburger: `aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu'}` ✅
- MenuCard add-to-cart: `aria-label={`Thêm ${item.name} vào giỏ hàng`}` ✅
- CartItem quantity: `aria-live="polite"` on count ✅
- BUT: Social icons in Footer use `aria-label` ✅
- BUT: Hero floating shapes have `aria-hidden="true"` ✅
- Hero scroll indicator is `aria-hidden="true"` — this is decorative, acceptable.

**CRITICAL: Emoji as icons without proper aria treatment** — See UX section 5.2. Emojis used as icons without `role="img"` or hidden from screen readers in most cases:
- MenuCard category badges use raw emoji inline — not hidden
- FiveZoneShowcase uses emoji icons — `aria-hidden="true"` missing on decorative emojis
- Contact page uses `&#128222;` (phone emoji) with `aria-hidden="true"` ✅ but inconsistent with other pages

**MEDIUM: `html` lang attribute** — Not programmatically verifiable from component audit; `main.tsx` should set `<html lang="vi">`.

**MEDIUM: Reduced motion** — `global.css:843` defines `@media (prefers-reduced-motion: reduce)` that disables all animations. ✅ Good practice.

### 4.2 Touch Target Audit

| Component | Size | Meets 44x44? |
|---|---|---|
| Navbar links (desktop) | `px-3 py-2` (~24x32px + padding) | ❌ |
| MenuCard "Add" button | `h-8 w-16` (32x64px) | ❌ height |
| CartItem + / - buttons | `h-7 w-7` (28x28px) | ❌ |
| Category tab buttons | `px-5 py-2.5` (~40x40px) | ❌ |
| Social icon links (footer) | `h-10 w-10` (40x40px) | ❌ (4px short) |

### 4.3 Recommendations

1. Set `<html lang="vi">` in `index.html` / root layout.
2. Increase all icon button touch targets to min 44x44px (use padding/inset).
3. Add `aria-hidden="true"` to ALL decorative emoji elements.
4. Add `role="img"` and `aria-label` to all informational emoji/icon elements.
5. Ensure `lang="vi"` is set on `<html>` for proper screen reader pronunciation.

---

## 5. UX Pattern Audit — 4/10 (CRITICAL)

### 5.1 Navigation

**GOOD:** Navbar has transparent default → glass on scroll. Mobile drawer slide-in. Active link underline animation. 7 navigation items cover all key pages.

**GOOD:** Logo links to home, accessible via keyboard.

**MEDIUM: No active/current page indicator** — Desktop nav links have hover underline (`after:w-3/5`) but no visual indicator for the current page. Users can't tell which page they're on.

**MEDIUM: Reviews link goes to `/reviews`** but there's no route for `/reviews` in App.tsx — this is a 404. Only `ReviewCard` component exists but no page route.

### 5.2 Emoji Usage (BRAND VIOLATION)

DESIGN.md explicitly states: **"Don't: Use emoji for icons — use SVG or Lucide icons"**

Found 30+ emoji instances across the app. Every major page violates this rule:

| Page | File | Emojis Used |
|---|---|---|
| Menu (empty) | `menu-grid.tsx:44` | `🔍` (search) |
| Menu (card) | `menu-card.tsx` | `☕ 🧊 🍵 🥤 🍊 🥛 🫧 🍹 🥐 🎯 🧴 🍽️` |
| Checkout (form) | `checkout-form.tsx:140,153,237,241` | `⚡ 📅 ⚡ 🔒` |
| Checkout (pay) | `payment-method-selector.tsx:60` | `💵 🏦` |
| Checkout (delivery) | `delivery-info.tsx:38` | `📍` |
| About Us | `AboutUs.tsx:36-39` | `☕ 🌱 🤝 ✨` |
| About Us (team) | `AboutUs.tsx:43-48` | `👨‍💼 👩‍🍳 👨‍🎨 👩‍💼 👨‍🔧 👩‍🎤` |
| Zones | `five-zone-showcase.tsx` | `🌿 🌅 🛋️ 🌇 🏗️` |
| Admin Login | `AdminLogin.tsx:50,96,150` | `✅ ☕ ⚠️` |
| Admin Dashboard | `StatsCard.tsx` | `💰` (icon prop) |
| Admin Dashboard | `Dashboard.tsx:58` | Icon prop `💰` |
| Contact | `Contact.tsx:74` | `📞` |
| Reviews (empty) | `ReviewsPage.tsx:117` | `☕` (HTML entity) |
| Reviews (stats) | `ReviewsPage.tsx` | Icon svg in RatingStars ✅ |

This is the most pervasive UX issue. Emojis render inconsistently across platforms (Google vs Apple vs Windows) and visually cheapen the industrial-luxury brand.

### 5.3 Form Usability

**GOOD:** Checkout form has:
- Labeled inputs with `htmlFor`/`id` association ✅
- Error messages with `role="alert"` ✅
- Zod validation schema ✅
- Loading state on submit ✅
- Double-submit guard ✅

**MEDIUM:** The Tailwind `Input` component renders white background (`bg-white`) on the dark navy page — creates a jarring "floating white box" effect. This is the light-mode issue again.

**MEDIUM:** Delivery time selector uses ad-hoc styled buttons with no focus ring. The `fieldset` element lacks keyboard navigation between the two options.

### 5.4 Error States

| State | Implementation | Grade |
|---|---|---|
| Menu loading | Shimmer skeleton cards | B+ |
| Menu empty | Centered message with icon | B (emoji) |
| Checkout validation | Per-field error messages | A- |
| PayOS error | Inline error with retry button | A |
| Stats loading | Shimmer skeleton | B+ |
| Stats error | Message + retry button | A |
| Reviews empty | Coffee cup emoji + message | C (emoji) |
| Order failure | Dedicated page | A |
| Network error | Try-catch with retry option | A- |
| Cart empty | Icon + message | B+ |

### 5.5 Micro-interactions

**GOOD:**
- Navbar scroll transition (transparent → glass)
- Menu card hover scale + shadow + image zoom
- Stagger reveal for card lists
- Fade-in-up for hero elements
- Chrome glow pulse animation
- Scale pop for stat counters

**MEDIUM:** No page transitions — route changes are instant (no `view-transition` or animation). Given the animation-heavy design, missing page transitions feels abrupt.

### 5.6 Recommendations (Priority Order)

1. **Replace ALL emojis with Lucide icons or inline SVG** — This is the single biggest brand violation. Create icon components for: coffee, phone, map pin, clock, arrow, bag, search, payment methods, nature, social media. Remove `CATEGORY_EMOJI` mapping in `menu-card.tsx`.

2. **Fix generic component backgrounds** — Card, Input, Drawer, Button must use dark-surface colors matching the design system, not light/white backgrounds.

3. **Add active page indicator** to navbar — highlight current route with chrome underline or glow.

4. **Fix `/reviews` route** — add the route in App.tsx.

5. **Add page view transitions** — use CSS `@view-transition` or fade animation between routes.

6. **Keyboard-enhance delivery time selector** — use radio input pattern with proper keyboard navigation (arrow keys).

7. **Add empty state Lucide icons** — Replace `🔍` (search emoji) in menu-grid empty state with `Search` icon from lucide-react.

---

## 6. UI/UX Pro Max Design Intelligence — Recommendations

Based on the Pro Max search results for "industrial luxury cafe " and "chrome silver glassmorphism," the current Liquid Glass + Glassmorphism direction is correct. The search recommends:

1. **Style:** Liquid Glass + Glassmorphism (confirmed — current direction is correct)
2. **Landing:** Storytelling-Driven + Hero-Centric (AURA already has this)
3. **Animation:** Expo-out bezier easing, spring interactions, ambient light blobs (AURA has these partially)
4. **Color:** Premium dark + chrome accent (correct direction)
5. **Dashboard:** Sales Intelligence Dashboard (admin needs this)

**Pro Max recommendations that AURA should adopt:**

- **Spring-based interactions** — Use CSS `cubic-bezier(0.34, 1.56, 0.64, 1)` for card scale-on-hover (currently `ease-out`). This creates a "bouncy" premium feel.
- **Ambient light on cards** — Add subtle `radial-gradient` overlay on cards that follows mouse (`.magnetic-btn::after` already exists — extend to cards).
- **Haptic-style press feedback** — Add `transform: scale(0.97)` on button press (active state), not just hover.
- **Chrome accent glow behind CTAs** — Already present in `glow-primary` class. Ensure EVERY primary CTA uses it.
- **Avoid pure `#000000`** — Spec already says no pure white. Also ensure no pure black in gradients.

---

## 7. Summary of Action Items

### Priority 1 (CRITICAL — Fix immediately)

| # | Issue | Files Affected | Fix |
|---|---|---|---|
| 1 | Tailwind @theme uses light colors | `global.css` | Rewrite @theme for dark-only |
| 2 | Generic components white on dark | `Card, Input, Drawer, Button, Skeleton` | Use glass-card spec |
| 3 | Three font families conflict | `brand-tokens.css`, 3 pages | Consolidate to Cormorant + Space Grotesk |
| 4 | Emoji everywhere (30+ instances) | 10+ files | Replace with Lucide/SVG icons |
| 5 | EB_Garamond inline in 3 pages | `AboutUs, Contact, ReviewsPage` | Replace with `font-display` |

### Priority 2 (HIGH — Fix this sprint)

| # | Issue | Fix |
|---|---|---|
| 6 | `/reviews` route missing | Add to App.tsx |
| 7 | Navbar no active page indicator | Add current route highlight |
| 8 | Touch targets under 44px on icon buttons | Increase padding |
| 9 | headline-md 20px vs 24px spec | Fix font size |
| 10 | Section spacing inconsistent (py-20 vs py-12) | Standardize to 48px |

### Priority 3 (MEDIUM — Polish)

| # | Issue | Fix |
|---|---|---|
| 11 | Forest green tokens unused | Use in bar/zone pages |
| 12 | Page transitions missing | Add fade animation |
| 13 | Container padding 16px vs 24px spec | Use px-6 desktop |
| 14 | Spring easing on card hover | Replace with `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| 15 | CTA press state | Add `active:scale-95` |

---

## 8. Files Requiring Changes

```
CRITICAL:
  /Users/macbook/FnB-Container-Caffe/src/styles/brand-tokens.css    (fonts, dark tokens)
  /Users/macbook/FnB-Container-Caffe/src/styles/global.css          (tailwind @theme)
  /Users/macbook/FnB-Container-Caffe/src/components/ui/card.tsx     (bg-white → glass)
  /Users/macbook/FnB-Container-Caffe/src/components/ui/input.tsx    (bg-white → dark)
  /Users/macbook/FnB-Container-Caffe/src/components/ui/drawer.tsx   (bg-white → dark)
  /Users/macbook/FnB-Container-Caffe/src/components/ui/button.tsx   (bg-primary → chrome)
  /Users/macbook/FnB-Container-Caffe/src/components/ui/skeleton.tsx (bg-muted → dark)

HIGH:
  /Users/macbook/FnB-Container-Caffe/src/components/menu/menu-card.tsx      (emoji ban)
  /Users/macbook/FnB-Container-Caffe/src/components/menu/menu-grid.tsx      (emoji ban)
  /Users/macbook/FnB-Container-Caffe/src/components/order/checkout-form.tsx (emoji ban)
  /Users/macbook/FnB-Container-Caffe/src/components/order/payment-method-selector.tsx (emoji)
  /Users/macbook/FnB-Container-Caffe/src/components/order/delivery-info.tsx (emoji)
  /Users/macbook/FnB-Container-Caffe/src/components/home/five-zone-showcase.tsx (emoji)
  /Users/macbook/FnB-Container-Caffe/src/components/admin/StatsCard.tsx     (emoji)
  /Users/macbook/FnB-Container-Caffe/src/pages/AboutUs.tsx                  (font, emoji)
  /Users/macbook/FnB-Container-Caffe/src/pages/Contact.tsx                  (font, emoji)
  /Users/macbook/FnB-Container-Caffe/src/pages/ReviewsPage.tsx              (font, emoji)
  /Users/macbook/FnB-Container-Caffe/src/pages/admin/Login.tsx              (emoji)
  /Users/macbook/FnB-Container-Caffe/src/components/ui/navbar.tsx           (active state)
  /Users/macbook/FnB-Container-Caffe/src/App.tsx                            (reviews route)

MEDIUM:
  /Users/macbook/FnB-Container-Caffe/DESIGN.md                             (canonical chrome hex)
```

---

## Scores Summary

| Category | Score | Key Issue |
|---|---|---|
| Color System | 5/10 | Tailwind @theme light-mode; generic components white-on-dark |
| Typography | 3/10 | 3 conflicting font families; spec vs CSS mismatch |
| Layout/Spacing | 7/10 | Mostly consistent; section margins exceed spec |
| Accessibility | 6/10 | Contrast OK; touch targets under; emoji accessibility poor |
| UX Patterns | 4/10 | Widespread emoji violation; white components on dark; missing route |
| **Overall** | **5/10** | **Strong spec, weak implementation — needs font + color + emoji remediation** |
