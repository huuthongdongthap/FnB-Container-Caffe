---
theme:
  name: "AURA CAFE — Industrial Luxury"
  mode: dark

colors:
  primary: "#c6c6c7"         # Chrome/silver — main interactive
  on-primary: "#1a1a2e"
  primary-container: "#e2e2e2"
  on-primary-container: "#636565"
  secondary: "#4a6fa5"        # Muted blue
  on-secondary: "#ffffff"
  tertiary: "#d4a574"         # Warm bronze accent
  on-tertiary: "#1a1a2e"
  error: "#ffb4ab"
  on-error: "#690005"
  surface: "#0d1b2a"         # Deep navy base
  on-surface: "#e8e8e8"
  surface-dim: "#0A1A2E"
  surface-bright: "#1a2d42"
  surface-container: ["#050D1A", "#0d1b2a", "#162a3d", "#1e3550"]
  on-surface-variant: "#a0a8b0"
  outline: "#2a3f55"
  outline-variant: "#1a2f45"
  background: "#0A1A2E"
  on-background: "#e8e8e8"
  surface-tint: "#c6c6c7"
  inverse-surface: "#e8e8e8"
  inverse-on-surface: "#0d1b2a"

typography:
  font-family:
    display: ["Cormorant Garamond", "Georgia", "serif"]
    body: ["Space Grotesk", "Inter", "sans-serif"]
    mono: ["JetBrains Mono", "monospace"]
  levels:
    display-lg:
      font-size: 72px
      line-height: 1.1
      font-weight: 700
      letter-spacing: "-0.03em"
    display-md:
      font-size: 48px
      line-height: 1.15
      font-weight: 600
    headline-lg:
      font-size: 32px
      line-height: 1.25
      font-weight: 600
    headline-md:
      font-size: 24px
      line-height: 1.3
      font-weight: 500
    title-lg:
      font-size: 20px
      line-height: 1.4
      font-weight: 600
    title-md:
      font-size: 18px
      line-height: 1.4
      font-weight: 500
    body-lg:
      font-size: 18px
      line-height: 1.6
      font-weight: 400
    body-md:
      font-size: 16px
      line-height: 1.5
      font-weight: 400
    body-sm:
      font-size: 14px
      line-height: 1.5
      font-weight: 400
    label-lg:
      font-size: 14px
      line-height: 1.4
      font-weight: 600
      letter-spacing: "0.02em"
    label-sm:
      font-size: 12px
      line-height: 1.4
      font-weight: 600
      letter-spacing: "0.05em"

spacing:
  unit: 8px
  container-padding: 24px
  card-gap: 16px
  section-margin: 48px
  grid-gap: 20px

rounded:
  sm: 4px
  DEFAULT: 8px
  md: 12px
  lg: 16px
  xl: 24px
  full: 9999px

elevation:
  level-0: "none"
  level-1: "0 2px 8px rgba(0,0,0,0.3)"
  level-2: "0 4px 16px rgba(0,0,0,0.4)"
  level-3: "0 8px 32px rgba(0,0,0,0.5)"

motion:
  duration-fast: 150ms
  duration-normal: 250ms
  duration-slow: 400ms
  easing-default: "cubic-bezier(0.4, 0, 0.2, 1)"
  easing-emphasized: "cubic-bezier(0.2, 0, 0, 1)"

components:
  glass-card:
    background: "rgba(255,255,255,0.03)"
    border: "1px solid rgba(255,255,255,0.08)"
    backdrop-filter: "blur(12px)"
    rounded: lg
    padding: 20px
    hover:
      border: "1px solid rgba(198,198,199,0.3)"
      transform: "scale(1.01)"
      transition: "all 250ms cubic-bezier(0.4, 0, 0.2, 1)"

  button-primary:
    background: "linear-gradient(135deg, #e8e8e8, #b0b0b0)"
    color: "#0d1b2a"
    font: label-lg
    rounded: xl
    padding: "12px 32px"
    height: 48px
    hover:
      transform: "scale(1.02)"
      box-shadow: "0 4px 20px rgba(200,200,200,0.2)"

  button-outline:
    background: "transparent"
    border: "1.5px solid rgba(198,198,199,0.4)"
    color: primary
    font: label-lg
    rounded: xl
    padding: "12px 32px"
    height: 48px
    hover:
      border-color: primary
      background: "rgba(198,198,199,0.08)"

  button-ghost:
    background: "transparent"
    color: on-surface-variant
    font: label-lg
    rounded: lg
    padding: "8px 16px"
    hover:
      background: "rgba(255,255,255,0.05)"

  input-field:
    background: "rgba(255,255,255,0.05)"
    border: "1px solid rgba(255,255,255,0.1)"
    color: on-surface
    placeholder-color: on-surface-variant
    font: body-md
    rounded: lg
    padding: "12px 16px"
    height: 48px
    focus:
      border-color: primary
      box-shadow: "0 0 0 2px rgba(198,198,199,0.15)"

  nav-link:
    color: on-surface-variant
    font: label-lg
    hover:
      color: primary
      text-decoration: "underline underline-offset-4"

  stat-card:
    background: surface-container
    border: "1px solid rgba(255,255,255,0.05)"
    rounded: lg
    padding: 20px
    hover:
      background: surface-bright

  menu-card:
    background: "rgba(255,255,255,0.03)"
    backdrop-filter: "blur(12px)"
    border: "1px solid rgba(255,255,255,0.08)"
    rounded: lg
    padding: 16px
    hover:
      transform: "scale(1.02)"
      border-color: "rgba(198,198,199,0.3)"

  badge:
    background: "rgba(198,198,199,0.15)"
    color: primary
    font: label-sm
    rounded: full
    padding: "4px 12px"

  divider:
    border-color: "rgba(255,255,255,0.06)"

---

# AURA CAFE — Design System

## Overview

AURA CAFE is an industrial-luxury container cafe located in Sa Dec, Dong Thap, Vietnam. The brand fuses raw industrial elements (shipping containers, steel, concrete) with refined luxury (chrome, glass, warm lighting). The design system reflects this duality: dark matte navy backgrounds with bright chrome/silver accents, frosted glass surfaces, and warm bronze tertiary touches.

The emotional tone is **sophisticated, warm, and nocturnal** — like a premium rooftop lounge. The UI should feel like looking through a frosty glass at glowing city lights.

## Colors

### Palette Philosophy

- **Dark Navy Base (#0A1A2E → #050D1A):** Evokes the night sky over Sa Dec. The deep, rich background grounds all content and creates a premium, intimate atmosphere.
- **Chrome/Silver Primary (#c6c6c7):** The hero accent — representing the metal containers and polished surfaces. Used for primary text, CTAs, and decorative borders.
- **Warm Bronze Tertiary (#d4a574):** Accent warmth — wood tones, warm lighting inside containers. Used sparingly for highlights and decorative elements.
- **Surface Containers:** Layered navy tones create depth hierarchy without relying on shadows. Lowest container (#050D1A) for modals, highest (#1e3550) for cards.

### Usage Rules

- **Never use pure white (#FFFFFF)** for backgrounds — always use tinted surface colors
- **Text on dark surfaces:** Primary text uses chrome (#c6c6c7), body text uses light gray (#e8e8e8), secondary text uses muted (#a0a8b0)
- **Borders:** Use `rgba(255,255,255,0.06)` for subtle dividers, `rgba(255,255,255,0.08)` for card borders, `rgba(198,198,199,0.3)` for hover states
- **Error states:** Keep the red error palette but desaturate slightly to match the muted aesthetic

## Typography

### Font Selection

- **Cormorant Garamond (Display):** An elegant serif for headlines and branding. The contrast between thick/thin strokes evokes the industrial-luxury tension. Used for H1-H2, hero text, pricing, and any large display text.
- **Space Grotesk (Body):** A geometric sans-serif that balances the ornate serif headlines. Clean, technical, and readable. Used for all body text, labels, buttons, and UI elements.
- **JetBrains Mono (Code/Mono):** Used only for technical data display (admin panels, code, timestamps).

### Hierarchy

- Display sizes use Cormorant Garamond with tight letter-spacing for dramatic headlines
- Button and label text uses Space Grotesk with letter-spacing for clarity
- Body text uses generous line-height (1.5-1.6) for readability on dark backgrounds
- On frosted glass surfaces, bump font-weight up by one tier to maintain legibility

## Layout & Spacing

### Grid System

An 8px base unit governs all spacing. Key measurements:
- **Container padding:** 24px (desktop), 16px (mobile)
- **Section spacing:** 48px vertical
- **Card grids:** 1 col mobile, 2 col tablet, 3-4 col desktop with 20px gaps
- **Content max-width:** 1200px (6xl)

### Page Structure

Each page follows a consistent rhythm:
1. **Hero/Header** — Full-width branding zone with gradient background
2. **Content Section** — Max-width container with card grid
3. **CTA Section** — Optional call-to-action band
4. **Footer** — Full-width dark container

## Elevation & Depth

AURA uses a **flat-but-layered** elevation system. Depth comes from color variation, not shadows:

| Level | Surface | Use |
|-------|---------|-----|
| 0 | `#050D1A` | Background base |
| 1 | `#0A1A2E` | Page background |
| 2 | `#0d1b2a` | Card surface |
| 3 | `rgba(255,255,255,0.03)` + backdrop-blur | Glass cards, modals |

Subtle box-shadows are used sparingly — only for elevated elements like dropdowns and modals.

## Shapes & Components

### Cards (Glassmorphism)

The signature AURA component is the "frosted glass card." Properties:
- `backdrop-filter: blur(12px)` for the glass effect
- Semi-transparent background at `rgba(255,255,255,0.03)`
- Thin border at `rgba(255,255,255,0.08)`
- 16px (`rounded-lg`) corner radius
- Subtle 1.01x scale + border glow on hover

### Buttons

- **Primary:** Chrome gradient (silver → light gray) on dark text. XL rounded. Lifts slightly on hover with glow shadow.
- **Outline:** Clear with chrome border. For secondary actions. Hover fills with subtle chrome tint.
- **Ghost:** Minimal, used for tertiary actions. Only shows background on hover.

### Inputs

Dark-toned inputs with subtle chrome border on focus. 48px height for touch targets. Label floating or above.

### Badges / Chips

Semi-transparent chrome badges for categories, order status, and tags. Full rounded with small font.

## Responsive Behavior

- **Mobile (320px-767px):** Single column, hamburger nav, touch-optimized 48px targets
- **Tablet (768px-1023px):** 2-column grids, visible nav items
- **Desktop (1024px+):** Multi-column grids, full nav, hover effects enabled

## Do's and Don'ts

### Do
- Use dark backgrounds with chrome accents
- Apply glassmorphism to cards and containers
- Keep generous whitespace — the design needs room to breathe
- Use gradient mesh backgrounds for hero sections
- Maintain 8px spacing rhythm

### Don't
- Use bright/light backgrounds (no white, no light gray pages)
- Stack too many glass surfaces — one level of blur is enough
- Use emoji for icons — use SVG or Lucide icons
- Overuse the bronze accent — it's for highlights only
- Apply heavy shadows — rely on color depth instead
