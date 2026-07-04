---
name: Nocturnal Industrial
colors:
  surface: '#081425'
  surface-dim: '#081425'
  surface-bright: '#2f3a4c'
  surface-container-lowest: '#040e1f'
  surface-container-low: '#111c2d'
  surface-container: '#152031'
  surface-container-high: '#1f2a3c'
  surface-container-highest: '#2a3548'
  on-surface: '#d8e3fb'
  on-surface-variant: '#c5c6cd'
  inverse-surface: '#d8e3fb'
  inverse-on-surface: '#263143'
  outline: '#8e9097'
  outline-variant: '#44474d'
  surface-tint: '#b8c7e2'
  primary: '#b8c7e2'
  on-primary: '#223146'
  primary-container: '#0a1a2e'
  on-primary-container: '#74839c'
  inverse-primary: '#505f76'
  secondary: '#ffb779'
  on-secondary: '#4c2700'
  secondary-container: '#955200'
  on-secondary-container: '#ffd9bc'
  tertiary: '#c1c7cf'
  on-tertiary: '#2b3137'
  tertiary-container: '#141a20'
  on-tertiary-container: '#7c838a'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d4e3ff'
  primary-fixed-dim: '#b8c7e2'
  on-primary-fixed: '#0c1c30'
  on-primary-fixed-variant: '#39475e'
  secondary-fixed: '#ffdcc1'
  secondary-fixed-dim: '#ffb779'
  on-secondary-fixed: '#2e1500'
  on-secondary-fixed-variant: '#6c3a00'
  tertiary-fixed: '#dde3eb'
  tertiary-fixed-dim: '#c1c7cf'
  on-tertiary-fixed: '#161c22'
  on-tertiary-fixed-variant: '#41474e'
  background: '#081425'
  on-background: '#d8e3fb'
  surface-variant: '#2a3548'
typography:
  display-lg:
    fontFamily: EB Garamond
    fontSize: 64px
    fontWeight: '500'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: EB Garamond
    fontSize: 40px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: EB Garamond
    fontSize: 32px
    fontWeight: '500'
    lineHeight: '1.3'
  headline-sm:
    fontFamily: EB Garamond
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-caps:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.1em
  ui-button:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1280px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
---

## Brand & Style
The design system embodies "Industrial Luxury Noir," a synthesis of raw architectural precision and high-end hospitality. It targets a discerning, late-night demographic that values exclusivity and atmospheric depth. The emotional response is one of calm sophistication, precision, and immersive luxury.

The visual style is a hybrid of **Glassmorphism** and **Minimalism**, set against a deep, nocturnal backdrop. We employ translucent layers with heavy backdrop blurs to simulate thick glass, punctuated by sharp metallic accents and industrial textures. The aesthetic is "precise but moody," using high-contrast highlights to guide the eye through a dark, structured environment.

## Colors
The palette is centered on a deep "Midnight Navy" base that provides the foundation for the nocturnal atmosphere. 

- **Primary (Midnight Navy):** Used for the background and core structural surfaces. It must remain deep and desaturated to allow glass effects to pop.
- **Accent (Bronze):** Inspired by aged metal and warm cafe lighting. Used sparingly for calls to action, active states, and brand signatures.
- **Highlight (Chrome/Silver):** Delivered primarily through linear gradients (e.g., `#94A3B8` to `#F8FAFC`). Used for thin borders and metallic details to convey an industrial edge.
- **Glass Surfaces:** Semi-transparent variants of the neutral scale (e.g., `rgba(30, 41, 59, 0.6)`) with a `24px` backdrop blur.

## Typography
The typographic pairing creates a tension between historical luxury and modern precision. 

**EB Garamond** is reserved for editorial moments, storytelling, and high-level headings. It should be typeset with generous leading and tight letter-spacing for larger displays to emphasize its elegant, classical proportions.

**Hanken Grotesk** handles all functional UI, data, and body copy. Its clean, sharp geometry provides the "Industrial" counterweight to the serif. Use the `label-caps` style for technical metadata or small headers above glass panels to reinforce the blueprint-like precision of the design system.

## Layout & Spacing
This design system utilizes a **fixed grid** approach for desktop to maintain the "framed" look of a luxury publication, while transitioning to a fluid model for mobile devices.

The layout logic is governed by an 8px base unit. Wide gutters (24px) ensure that glass panels have breathing room to showcase their backdrop blurs without visual clutter. For desktop, use a 12-column grid with significant side margins to create a focused, "letterboxed" experience. On mobile, margins reduce to 20px, and content reflows into a single vertical column.

## Elevation & Depth
Depth is not communicated through traditional shadows, but through **Tonal Layers** and **Backdrop Effects**.

1.  **Level 0 (Base):** Solid `#0A1A2E`.
2.  **Level 1 (Panels):** Translucent overlays with a `24px` blur and a `1px` inner stroke of `rgba(255, 255, 255, 0.1)` to simulate the edge of glass.
3.  **Level 2 (Floating Elements):** Increased transparency and a subtle Chrome gradient border (`#94A3B8` at 30% opacity).
4.  **Highlights:** Subtle "rim lighting" effect using a very thin, top-aligned inner shadow in Bronze for primary interactive elements.

## Shapes
The shape language is architectural and disciplined. We use **Soft (0.25rem)** rounding for standard components like input fields and small buttons to maintain a "machined" feel. Larger glass cards may use `rounded-lg` (0.5rem) to soften the overall composition, but sharp angles are generally preferred over overly rounded "bubbly" forms to preserve the industrial aesthetic.

## Components
- **Glassmorphic Cards:** Background: `rgba(30, 41, 59, 0.4)`; Backdrop-filter: `blur(24px)`; Border: `1px solid rgba(255, 255, 255, 0.1)`. 
- **Metallic Buttons:** Primary buttons use a linear gradient of Bronze (`#CD7F32` to `#A0522D`). Text is dark Navy for high contrast. Secondary buttons are "Ghost" style with a Chrome border.
- **Status Badges:** High-contrast, small, and sharp. Use solid background colors (e.g., Bronze or Silver) with `label-caps` typography.
- **Input Fields:** Darker than the base background, with a `1px` bottom-only border that glows Bronze when focused.
- **Lists:** Separated by thin, `0.5px` silver lines at 20% opacity. No alternating row colors; use hover states with a subtle increase in glass opacity.
- **Navigation:** Top-fixed, heavy blur glass bar with a single Chrome line separating it from the content.