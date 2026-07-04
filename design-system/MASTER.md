# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** FnB Container Caffe
**Generated:** 2026-07-04 (updated from Stitch exports)
**Category:** Cafe/Container F&B
**Brand:** AURA CAFE — Industrial Luxury (Dark Navy + Chrome + Bronze)

---

## Color Palette

Extracted from two Stitch-generated HTML files in `stitch-exports/stitch_aura_cafe/`.
Both use Material 3 dark scheme. Role assignments vary per page (documented below).

### Core Palette (shared across all pages)

| Role | Hex | Usage |
|------|-----|-------|
| background | `#00142c` | Page background (deep navy) |
| surface | `#00142c` | Surface base |
| surface-dim | `#00142c` / `#081425` | Dimmed surface (varies by page) |
| surface-bright | `#273a55` / `#2f3a4c` | Bright surface layer |
| surface-container | `#0b203a` / `#152031` | Card surface |
| surface-container-low | `#061c35` / `#111c2d` | Low-elevation surface |
| surface-container-lowest | `#000e23` / `#040e1f` | Deepest surface |
| surface-container-high | `#172b45` / `#1f2a3c` | High-elevation surface |
| surface-container-highest | `#223550` / `#2a3548` | Highest surface |
| surface-variant | `#223550` / `#2a3548` | Variant surface |
| on-surface | `#d4e3ff` / `#d8e3fb` | Text on surface (ice blue) |
| on-surface-variant | `#c5c6cd` | Secondary text (silver-gray) |
| primary | `#b8c7e2` | Primary interactive color (silver-blue) |
| on-primary | `#223146` | Text on primary |
| primary-container | `#0a1a2e` | Primary container bg |
| on-primary-container | `#74839c` | Text on primary container |
| primary-fixed | `#d4e3ff` | Primary fixed |
| primary-fixed-dim | `#b8c7e2` | Primary fixed dim |
| on-primary-fixed | `#0c1c30` | Text on primary fixed |
| on-primary-fixed-variant | `#39475e` | Text on primary fixed variant |
| error | `#ffb4ab` | Error |
| on-error | `#690005` | Text on error |
| error-container | `#93000a` | Error container bg |
| on-error-container | `#ffdad6` | Text on error container |
| outline | `#8e9097` | Borders, dividers |
| outline-variant | `#44474d` | Subtle borders |
| inverse-surface | `#d4e3ff` / `#d8e3fb` | Inverse surface |
| inverse-on-surface | `#1e314b` / `#263143` | Text on inverse surface |
| inverse-primary | `#505f76` | Inverse primary |
| surface-tint | `#b8c7e2` | Surface tint |

### Secondary / Tertiary (page-dependent role assignments)

**Hero page** (`aura-cafe-hero`):
| Role | Hex | Usage |
|------|-----|-------|
| secondary | `#c6c6c7` | Chrome/silver metallic — nav links, borders, decorative lines |
| on-secondary | `#2f3132` | Text on chrome |
| secondary-container | `#454748` | Chrome container |
| on-secondary-container | `#b5b5b6` | Text on chrome container |
| tertiary | `#efbd8a` | Warm bronze — CTAs, signature badges, highlights |
| on-tertiary | `#472a03` | Text on bronze |
| tertiary-container | `#291500` | Bronze container bg |
| on-tertiary-container | `#a47a4d` | Text on bronze container |
| on-tertiary-fixed | `#2c1700` | Text on tertiary fixed |

**Container Landing page** (`aura-cafe-container-landing`):
| Role | Hex | Usage |
|------|-----|-------|
| secondary | `#efbd8a` | Warm bronze — CTAs, highlights (swapped with tertiary) |
| on-secondary | `#472a03` | Text on bronze |
| secondary-container | `#64421a` | Bronze container bg |
| on-secondary-container | `#dfaf7e` | Text on bronze container |
| tertiary | `#c1c7cf` | Silver-gray (replaces chrome as tertiary) |
| on-tertiary | `#2b3137` | Text on silver-gray |
| tertiary-container | `#141a20` | Silver-gray container |
| on-tertiary-container | `#7c838a` | Text on silver-gray container |

> **Important:** This role swap is intentional in Material 3 dynamic color. When implementing a specific page, check the page-specific token file in `pages/`.

---

## Typography

### Font Families

| Role | Font |
|------|------|
| Display/Headline | Libre Caslon Text (serif) — OR — EB Garamond (serif) — varies by page |
| Body | Space Grotesk (sans-serif, geometric) |
| Labels | Space Grotesk |

### Type Scale (consolidated from both pages)

| Name | Font | Size | Line-Height | Weight | Letter-Spacing | Page |
|------|------|------|-------------|--------|---------------|------|
| display-lg | Libre Caslon Text | 64px | 72px (1.125) | 400 | -0.02em | Hero |
| display-lg-mobile | Libre Caslon Text | 40px | 48px (1.2) | 400 | -0.01em | Hero |
| headline-xl | EB Garamond | 64px | 1.1 | 500 | -0.02em | Container |
| headline-lg | EB Garamond | 48px | 1.2 | 500 | -0.01em | Container |
| headline-lg-mobile | EB Garamond | 36px | 1.2 | 500 | — | Container |
| headline-md | Libre Caslon Text / EB Garamond | 32px | 40px (1.25) / 1.3 | 400 / 500 | — | Both |
| headline-sm | Libre Caslon Text / EB Garamond | 24px | 32px (1.33) / 1.4 | 400 / 600 | — | Both |
| body-lg | Space Grotesk | 18px | 28px (1.56) / 1.6 | 400 | — | Both |
| body-md | Space Grotesk | 16px | 24px (1.5) / 1.6 | 400 | — | Both |
| body-sm | Space Grotesk | 14px | 1.5 | 400 | — | Container only |
| label-caps | Space Grotesk | 12px | 16px (1.33) / 1.0 | 600 | 0.1em | Both |
| label-md | Space Grotesk | 14px | 20px | 500 | — | Hero only |

---

## Spacing

| Token | Value | Usage |
|-------|-------|-------|
| unit | 8px | Base grid unit |
| gutter | 24px | Gap between cards, nav items |
| margin-desktop | 64px | Page horizontal padding (desktop) |
| margin-mobile | 20px | Page horizontal padding (mobile) |
| container-max | 1200px-1280px | Max content width |

---

## Border Radius

| Token | Hero Page | Container Landing |
|-------|-----------|-------------------|
| DEFAULT | 0.125rem (2px) | 0.25rem (4px) |
| lg | 0.25rem (4px) | 0.5rem (8px) |
| xl | 0.5rem (8px) | 0.75rem (12px) |
| full | 0.75rem (12px) | 9999px |

---

## Glassmorphism

**Hero page:**
```css
background: rgba(255, 255, 255, 0.05);
backdrop-filter: blur(20px);
border: 1px solid rgba(198, 198, 199, 0.15);
```

**Container Landing:**
```css
background: rgba(148, 163, 184, 0.1);
backdrop-filter: blur(12px);
border: 1px solid transparent;
border-image: linear-gradient(135deg, #94A3B8 0%, rgba(148, 163, 184, 0) 100%) 1;
```

---

## Shadows

| Name | Value | Usage |
|------|-------|-------|
| bronze-glow | `0 0 20px rgba(212, 165, 116, 0.15)` | Button glow (static) |
| bronze-glow-hover | `0 0 30px rgba(212, 165, 116, 0.35)` | Button glow on hover |
| nav-shadow | `0 0 30px rgba(212, 165, 116, 0.1)` | Navigation bar |

---

## Gradients

```css
/* Hero ambient background */
.nocturnal-gradient {
  background: radial-gradient(circle at top right, rgba(184, 199, 226, 0.05), transparent 60%),
              radial-gradient(circle at bottom left, rgba(212, 165, 116, 0.03), transparent 50%);
}

/* Chrome decorative line */
.chrome-line {
  background: linear-gradient(90deg, transparent, rgba(198, 198, 199, 0.3), transparent);
  height: 1px;
}

/* Metallic CTA button */
.metallic-gradient {
  background: linear-gradient(135deg, #D4A574 0%, #B48554 100%);
}

/* Container rib pattern */
.container-ribs {
  background-image: linear-gradient(90deg, rgba(30, 41, 59, 0.5) 1px, transparent 1px);
  background-size: 80px 100%;
}
```

---

## Filter / Blur Effects

| Effect | Value | Usage |
|--------|-------|-------|
| glass-blur | `blur(20px)` | Hero glass panels |
| glass-blur-subtle | `blur(12px)` | Container landing glass panels |
| ambient-glow | `blur(120px)` | Large decorative blur circles |
| nav-blur | `backdrop-filter: blur(12px)` or `blur(20px)` | Fixed navigation bar |

---

## Component Specs

### Glass Card

```css
background: rgba(255, 255, 255, 0.05); /* Hero */
/* or */ rgba(148, 163, 184, 0.1); /* Container Landing */
backdrop-filter: blur(12px);
border: 1px solid rgba(198, 198, 199, 0.15);
border-radius: 0.75rem;
padding: 24px;
transition: transform 0.5s ease;
```

### Primary CTA Button

| Property | Hero | Container Landing |
|----------|------|-------------------|
| background | `#291500` (tertiary-container) | `linear-gradient(135deg, #D4A574, #B48554)` |
| text color | `#472a03` (on-tertiary) | `#2c1700` (on-secondary-fixed) |
| border | `1px solid rgba(239, 189, 138, 0.5)` | none |
| border-radius | 0.5rem (xl) | square (0) |
| padding | 64px horizontal, 16px vertical | 40px horizontal, 20px vertical |
| font | label-caps (12px, uppercase, tracking-widest) | label-caps |
| hover | `box-shadow: 0 0 30px rgba(212, 165, 116, 0.35)` | same |

### Outline Button

```css
background: transparent;
border: 1px solid rgba(198, 198, 199, 0.3); /* Hero secondary/30 */
/* or */ 1px solid #8e9097; /* Container outline */
color: #c6c6c7; /* Hero */ /* or */ #d8e3fb; /* Container */
border-radius: 0.5rem; /* Hero: rounded */ /* Container: square */
font: label-caps;
padding: 12px 64px; /* or */ 20px 40px;
```

### Glass Card with Hover

```css
/* Both pages use same pattern */
.glass-panel {
  padding: 24px;
  transition: transform 0.5s ease;
}
.glass-panel:hover {
  transform: translateY(-8px);
}
```

---

## Style Guidelines

**Style:** Industrial Luxury — Dark Nocturnal

**Keywords:** Dark navy, chrome/silver, warm bronze, frosted glass, container industrial, premium lounge, Vietnamese heritage, Material 3 dark

**Mood:** Sophisticated, warm, nocturnal — like a premium rooftop lounge in shipping containers

### Page Pattern

- **CTA Placement:** Above fold + hero center
- **Section Order:** Nav > Hero (glass panel + CTA) > Feature Bento Grid > Visual Teaser/Gallery > Location > Footer

### Navigation

- Fixed top, full-width
- Glass effect: `backdrop-filter: blur(12-20px)` with `rgba(255,255,255,0.05-0.15)` background
- Bottom border: thin, semi-transparent secondary/outline
- Optional bronze glow shadow: `0 0 30px rgba(212,165,116,0.1)`

---

## Anti-Patterns

- Do not use pure white (#FFFFFF) backgrounds
- Do not stack multiple glass layers — one blur level is sufficient
- Do not use heavy shadows — rely on color depth for elevation
- Do not overuse bronze accent — reserved for CTAs and highlights
- Do not use emoji for icons — use Material Symbols Outlined
