---
name: Nocturnal Industrial Luxury
colors:
  surface: '#00142c'
  surface-dim: '#00142c'
  surface-bright: '#273a55'
  surface-container-lowest: '#000e23'
  surface-container-low: '#061c35'
  surface-container: '#0b203a'
  surface-container-high: '#172b45'
  surface-container-highest: '#223550'
  on-surface: '#d4e3ff'
  on-surface-variant: '#c5c6cd'
  inverse-surface: '#d4e3ff'
  inverse-on-surface: '#1e314b'
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
  tertiary: '#c7c6c4'
  on-tertiary: '#303130'
  tertiary-container: '#191a19'
  on-tertiary-container: '#828281'
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
  tertiary-fixed: '#e3e2e0'
  tertiary-fixed-dim: '#c7c6c4'
  on-tertiary-fixed: '#1b1c1b'
  on-tertiary-fixed-variant: '#464746'
  background: '#00142c'
  on-background: '#d4e3ff'
  surface-variant: '#223550'
typography:
  headline-xl:
    fontFamily: Libre Caslon Text
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Libre Caslon Text
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Libre Caslon Text
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  stat-display:
    fontFamily: Libre Caslon Text
    fontSize: 40px
    fontWeight: '400'
    lineHeight: 48px
    letterSpacing: 0.05em
  body-lg:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Space Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.1em
  mono-data:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: -0.01em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  gutter: 24px
  margin-desktop: 40px
  margin-mobile: 16px
  container-padding: 24px
---

## Brand & Style
The design system embodies "Industrial Luxury"—a synthesis of high-precision engineering and high-end hospitality management. It is designed for the Aura Cafe admin environment, prioritizing a nocturnal, focused atmosphere that feels authoritative yet sophisticated.

The aesthetic leans heavily into **Glassmorphism** and **Chrome-inspired finishes**, utilizing the depth of dark space to highlight critical data. Visuals are defined by high-contrast metallic borders, translucent structural layers, and warm, hearth-like accents. The emotional response is one of absolute control, precision, and "behind-the-scenes" prestige.

## Colors
The palette is anchored in deep, midnight tones to reduce eye strain during late-night administrative shifts.

- **Primary (Dark Navy):** `#0A1A2E`. The foundation. Used for the lowest depth surfaces and background canvas.
- **Secondary (Warm Bronze):** `#CD7F32`. Represents the "human" element—heat, coffee, and luxury. Used for primary actions, success states, and highlighted data points.
- **Tertiary (Chrome/Platinum):** `#E5E4E2`. Used for borders, iconography, and high-precision UI elements. It mimics the brushed steel of high-end espresso machines.
- **Neutral (Deep Slate):** `#162A44`. Used for container surfaces and elevated glass layers.

## Typography
The typography strategy creates a tension between classical elegance and technical utility. 

**Libre Caslon Text** (serving as a high-quality alternative to Garamond) is reserved for large headlines and numerical data. Its high-contrast serifs provide a "boutique" feel to revenue figures and section titles.

**Space Grotesk** handles the industrial heavy lifting. Its geometric, technical quirks make it ideal for data tables, labels, and administrative controls. Use `label-caps` for all table headers and small metadata categories to maintain a disciplined, "blueprint" aesthetic.

## Layout & Spacing
The layout follows a **Rigid Fluid Grid**. While the sidebar and navigation are fixed, the content dashboard utilizes a 12-column system that scales fluidly.

- **Gutters:** 24px fixed to maintain "breathing room" between glass cards.
- **Margins:** Generous 40px margins on desktop to evoke a sense of spatial luxury.
- **Rhythm:** All spacing must be a multiple of 8px. Use larger gaps (48px+) between distinct functional blocks to prevent the interface from feeling cluttered despite the dark theme.

## Elevation & Depth
Depth is not achieved through shadows, but through **Tonal Opacity** and **Backdrop Blurs**.

- **Surface Level 0:** The #0A1A2E background.
- **Surface Level 1 (Glass):** 40% opacity of Neutral Slate with a 12px backdrop blur.
- **Surface Level 2 (Active):** 60% opacity with a 20px blur.
- **The Chrome Edge:** Every elevated container must have a 1px border. Use a linear gradient for this border (Top-Left: #E5E4E2, Bottom-Right: #162A44 at 20% opacity) to simulate a light source reflecting off a metallic edge.
- **Shadows:** Only used sparingly for high-z-index elements like modals. Use a "Bronze Glow" shadow (#CD7F32 at 15% opacity) rather than a black shadow to maintain the nocturnal warmth.

## Shapes
The design system uses a **Soft (0.25rem)** base roundedness to maintain an architectural, industrial feel. 

- Avoid "Pill" shapes entirely as they are too playful for this aesthetic. 
- Large dashboard cards use `rounded-lg` (0.5rem) to slightly soften the technical edge.
- Interactive elements like input fields and checkboxes remain strictly at the base 0.25rem radius.

## Components
- **Buttons:** Primary buttons use a solid Bronze (#CD7F32) with white text. Secondary buttons use a "Chrome Ghost" style: transparent background, 1px Chrome border, and White text.
- **Cards:** Must feature the "Chrome Edge" gradient border and backdrop blur. No solid backgrounds.
- **Input Fields:** Darker than the card surface (10% black overlay), with a Chrome bottom-border only. On focus, the border transitions to a Bronze gradient.
- **Lists/Tables:** Use "Zebra" striping with 5% white overlays rather than borders. Column headers use `label-caps` in Bronze.
- **Charts:** Use thin, glowing lines. Data points should have a small "aura" glow effect.
- **Status Chips:** Small, rectangular, with 1px borders matching the status color (e.g., Bronze for "Active", Chrome for "Pending").