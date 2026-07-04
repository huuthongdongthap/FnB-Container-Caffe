---
theme:
  name: "AURA CAFE — Industrial Luxury"
  mode: dark

colors:
  primary: "#b8c7e2"         # Silver-blue — main interactive (Material 3 primary)
  on-primary: "#223146"
  primary-container: "#0a1a2e"
  on-primary-container: "#74839c"
  secondary: "#c6c6c7"       # Chrome/silver metallic — nav links, borders
  on-secondary: "#2f3132"
  secondary-container: "#454748"
  on-secondary-container: "#b5b5b6"
  tertiary: "#efbd8a"        # Warm bronze — CTAs, highlights, signature badges
  on-tertiary: "#472a03"
  tertiary-container: "#291500"
  on-tertiary-container: "#a47a4d"
  error: "#ffb4ab"
  on-error: "#690005"
  error-container: "#93000a"
  on-error-container: "#ffdad6"
  surface: "#00142c"         # Deep navy base
  on-surface: "#d4e3ff"      # Ice blue text
  surface-dim: "#00142c"
  surface-bright: "#273a55"
  surface-container: "#0b203a"
  surface-container-low: "#061c35"
  surface-container-lowest: "#000e23"
  surface-container-high: "#172b45"
  surface-container-highest: "#223550"
  surface-variant: "#223550"
  on-surface-variant: "#c5c6cd"
  outline: "#8e9097"
  outline-variant: "#44474d"
  background: "#00142c"
  on-background: "#d4e3ff"
  surface-tint: "#b8c7e2"
  inverse-surface: "#d4e3ff"
  inverse-on-surface: "#1e314b"
  inverse-primary: "#505f76"

typography:
  font-family:
    display: ["Libre Caslon Text", "EB Garamond", "Georgia", "serif"]
    body: ["Space Grotesk", "Inter", "sans-serif"]
  levels:
    display-lg:
      font-size: 64px
      line-height: 1.125
      font-weight: 400
      letter-spacing: "-0.02em"
    display-lg-mobile:
      font-size: 40px
      line-height: 1.2
      font-weight: 400
      letter-spacing: "-0.01em"
    headline-lg:
      font-size: 48px
      line-height: 1.2
      font-weight: 500
      letter-spacing: "-0.01em"
    headline-md:
      font-size: 32px
      line-height: 1.25
      font-weight: 400
    headline-sm:
      font-size: 24px
      line-height: 1.33
      font-weight: 400
    body-lg:
      font-size: 18px
      line-height: 1.56
      font-weight: 400
    body-md:
      font-size: 16px
      line-height: 1.5
      font-weight: 400
    body-sm:
      font-size: 14px
      line-height: 1.5
      font-weight: 400
    label-caps:
      font-size: 12px
      line-height: 1.33
      font-weight: 600
      letter-spacing: "0.1em"
      text-transform: "uppercase"
    label-md:
      font-size: 14px
      line-height: 20px
      font-weight: 500

spacing:
  unit: 8px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
  container-max: 1200px
  section-gap: 48px

rounded:
  sm: 2px
  DEFAULT: 4px
  lg: 8px
  xl: 12px
  full: 9999px

elevation:
  level-0: "none"
  bronze-glow: "0 0 20px rgba(212, 165, 116, 0.15)"
  bronze-glow-hover: "0 0 30px rgba(212, 165, 116, 0.35)"
  nav-shadow: "0 0 30px rgba(212, 165, 116, 0.1)"

motion:
  duration-fast: 150ms
  duration-normal: 300ms
  duration-slow: 500ms
  easing-default: "ease"
  easing-glass-hover: "500ms ease"
  easing-nav-hide: "0.3s ease-in-out"

components:
  glass-card:
    background: "rgba(255, 255, 255, 0.05)"
    border: "1px solid rgba(198, 198, 199, 0.15)"
    backdrop-filter: "blur(20px)"
    rounded: xl
    padding: 24px
    hover:
      transform: "translateY(-8px)"
      transition: "transform 500ms ease"

  button-primary:
    background: "#291500"  # tertiary-container
    color: "#472a03"       # on-tertiary
    border: "1px solid rgba(239, 189, 138, 0.5)"
    font: label-caps
    rounded: xl            # hero: 8px rounded
    padding: "16px 64px"
    hover:
      box-shadow: "0 0 30px rgba(212, 165, 116, 0.35)"

  button-outline:
    background: "transparent"
    border: "1px solid rgba(198, 198, 199, 0.3)"
    color: "#c6c6c7"       # secondary/chrome
    font: label-caps
    rounded: xl
    padding: "16px 64px"
    hover:
      background: "rgba(255, 255, 255, 0.05)"

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

- **Deep Navy Base (#00142c → #000e23):** Evokes the night sky over Sa Dec. The deep, rich background grounds all content and creates a premium, intimate atmosphere.
- **Silver-Blue Primary (#b8c7e2):** The hero accent — representing polished steel and moonlit surfaces. Used for primary text, interactive elements, and decorative borders.
- **Chrome Secondary (#c6c6c7):** Metallic chrome representing the container steel. Used for nav links, utility borders, and decorative lines. (Note: In container landing page variant, secondary role swaps to bronze #efbd8a.)
- **Warm Bronze Tertiary (#efbd8a):** Accent warmth — wood tones, warm lighting, signature highlights. Used sparingly for CTAs, badges, and decorative elements. (Note: In container landing page variant, tertiary role swaps to silver-gray #c1c7cf.)
- **Surface Containers:** Layered navy tones create depth hierarchy without relying on shadows. Lowest container (#000e23) for modals, highest (#223550) for cards.

### Usage Rules

- **Never use pure white (#FFFFFF)** for backgrounds — always use tinted surface colors
- **Text on dark surfaces:** Primary text uses silver-blue (#b8c7e2), body text uses ice blue (#d4e3ff), secondary text uses silver-gray (#c5c6cd)
- **Borders:** Use `rgba(198,198,199,0.15)` for glass card borders, `rgba(198,198,199,0.3)` for outline button borders, `#8e9097` (outline) for visible dividers, `#44474d` (outline-variant) for subtle dividers
- **Error states:** Use Material 3 error palette: #ffb4ab (error), #93000a (error-container), #ffdad6 (on-error-container)

## Typography

### Font Selection

- **Libre Caslon Text (Display):** An elegant serif for headlines and branding. The contrast between thick/thin strokes evokes the industrial-luxury tension. Used for H1-H2, hero text, pricing, and any large display text. (Container landing page uses EB Garamond instead — both are serif with similar weight.)
- **Space Grotesk (Body):** A geometric sans-serif that balances the ornate serif headlines. Clean, technical, and readable. Used for all body text, labels, buttons, and UI elements.

### Hierarchy

- Display sizes use Libre Caslon Text with loose letter-spacing for dramatic headlines
- Button and label text uses Space Grotesk with 0.1em letter-spacing uppercase (`label-caps`)
- Body text uses generous line-height (1.5-1.6) for readability on dark backgrounds
- On frosted glass surfaces, bump font-weight up by one tier to maintain legibility

## Layout & Spacing

### Grid System

An 8px base unit governs all spacing. Key measurements:
- **Page padding:** 64px (desktop), 20px (mobile)
- **Section spacing:** 48-64px vertical
- **Card grids:** 1 col mobile, 3 col desktop with 24px (gutter) gaps
- **Content max-width:** 1200px (hero) / 1280px (container landing)

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
| 0 | `#00142c` / `#081425` | Page background |
| 1 | `#000e23` / `#040e1f` | Container background lowest |
| 2 | `#0b203a` / `#152031` | Card surface |
| 3 | `rgba(255,255,255,0.05)` + backdrop-blur(20px) | Glass cards, modals |
| 4 | `rgba(148,163,184,0.1)` + backdrop-blur(12px) | Container landing glass panels |

Bronze glow box-shadows are used for CTAs and navigation:
- `0 0 20px rgba(212,165,116,0.15)` — button glow
- `0 0 30px rgba(212,165,116,0.35)` — button hover glow
- `0 0 30px rgba(212,165,116,0.1)` — navigation bar glow

## Shapes & Components

### Cards (Glassmorphism)

The signature AURA component is the "frosted glass card." Properties:
- `backdrop-filter: blur(20px)` for the glass effect (hero) / `blur(12px)` (container landing)
- Semi-transparent background at `rgba(255,255,255,0.05)` (hero) / `rgba(148,163,184,0.1)` (container landing)
- Thin border at `rgba(198,198,199,0.15)` (hero) or gradient border `linear-gradient(135deg, #94A3B8 0%, transparent 100%)` (container landing)
- `12px` (`rounded-xl`) corner radius
- Subtle `translateY(-8px)` lift on hover with 500ms ease transition

### Buttons

- **Primary (Bronze CTA):** Dark bronze container bg (#291500) with bronze border (`rgba(239,189,138,0.5)`) and bronze text (#472a03). Uses `label-caps` font (12px uppercase 0.1em letter-spacing). Rounded at 8-12px. Hover shows bronze glow shadow (`0 0 30px rgba(212,165,116,0.35)`). Hero variant.
- **Primary (Metallic Gradient):** `linear-gradient(135deg, #D4A574, #B48554)` background with dark text. Square corners (no border-radius). Hover with bronze glow. Container landing variant.
- **Outline:** Clear background with chrome border (`rgba(198,198,199,0.3)`). Chrome text (#c6c6c7). Uses `label-caps` font. Rounded at 8-12px. Hover fills with subtle white tint.

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
