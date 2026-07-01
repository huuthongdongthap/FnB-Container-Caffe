# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** FnB Container Caffe
**Generated:** 2026-07-01 10:12:42
**Category:** Bakery/Cafe
**Brand:** AURA CAFE — Bazi v5.1 (Navy + Chrome/Silver + Mộc Wood Green)

---

## Global Rules

### Color Palette (Navy+Warm Hybrid — overrides search.py output)

| Role | Hex | CSS Variable | Usage |
|------|-----|--------------|-------|
| Primary | `#0A1628` | `--color-primary` | Deep navy base (Bazi 壬 Thủy water) |
| On Primary | `#FFFFFF` | `--color-on-primary` | White text on navy |
| Secondary | `#1B2D4F` | `--color-secondary` | Lighter navy surfaces |
| Accent/CTA | `#C9D6DF` | `--color-accent` | Chrome/Silver (Bazi 庚/辛 Kim metal) |
| Accent Warm | `#D4A574` | `--color-accent-warm` | Warm F&B accent (wood/copper) |
| Background | `#F5F0EB` | `--color-background` | Warm paper |
| Foreground | `#0A1628` | `--color-foreground` | Navy text |
| Muted | `#6B9FB8` | `--color-muted` | Muted steel blue |
| Border | `#3A6B80` | `--color-border` | Steel border |
| Destructive | `#DC2626` | `--color-destructive` | Red alerts |
| Ring | `#C9D6DF` | `--color-ring` | Chrome focus ring |
| Wood Green | `#2D5A3D` | `--color-wood` | Mộc green (Bazi 乙 Mộc) for forest zones |

**Color Notes:** Navy base replaces green primary. Chrome/Silver accents replace pink. Warm F&B accent added. Mộc wood green for bar/forest zones. Preserves Bazi v5.1 migration from gold.

### Typography (preserves Bazi v5.1 migration — overrides search.py output)

- **Display Font:** Cormorant Garamond (serif, elegant) — headings, hero, brand
- **Body Font:** Space Grotesk (sans-serif, geometric) — body text, navigation, forms
- **Utility Font:** Plus Jakarta Sans (sans-serif, modern) — labels, badges, captions
- **Mood:** Dark luxury, container industrial, chrome/silver accents, Vietnamese heritage
- **Font Files:** Local woff2 in `fonts/` directory (no Google Fonts CDN)

**CSS Import:**
```css
/* Already defined in css/brand-tokens.css v5.0 — local woff2 @font-face rules */
/* Cormorant Garamond + Space Grotesk + Plus Jakarta Sans */
```

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #EC4899;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #15803D;
  border: 2px solid #15803D;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #F0FDF4;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #15803D;
  outline: none;
  box-shadow: 0 0 0 3px #15803D20;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Vibrant & Block-based

**Keywords:** Bold, energetic, playful, block layout, geometric shapes, high color contrast, duotone, modern, energetic

**Best For:** Startups, creative agencies, gaming, social media, youth-focused, entertainment, consumer

**Key Effects:** Large sections (48px+ gaps), animated patterns, bold hover (color shift), scroll-snap, large type (32px+), 200-300ms

### Page Pattern

**Pattern Name:** Hero-Centric + Conversion

- **CTA Placement:** Above fold
- **Section Order:** Hero > Features > CTA

---

## Anti-Patterns (Do NOT Use)

- ❌ Poor food photos
- ❌ Hidden hours

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
