---
name: Aura Industrial Luxury
colors:
  surface: '#19120d'
  surface-dim: '#19120d'
  surface-bright: '#403731'
  surface-container-lowest: '#130d08'
  surface-container-low: '#211a14'
  surface-container: '#261e18'
  surface-container-high: '#302822'
  surface-container-highest: '#3c332d'
  on-surface: '#efe0d6'
  on-surface-variant: '#d8c2b2'
  inverse-surface: '#efe0d6'
  inverse-on-surface: '#372f28'
  outline: '#a18d7f'
  outline-variant: '#534438'
  surface-tint: '#ffb779'
  primary: '#ffb779'
  on-primary: '#4c2700'
  primary-container: '#cd7f32'
  on-primary-container: '#432200'
  inverse-primary: '#8e4e00'
  secondary: '#c7c6c4'
  on-secondary: '#303130'
  secondary-container: '#464746'
  on-secondary-container: '#b5b5b3'
  tertiary: '#b4c8e9'
  on-tertiary: '#1e314b'
  tertiary-container: '#7f92b1'
  on-tertiary-container: '#172b45'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdcc1'
  primary-fixed-dim: '#ffb779'
  on-primary-fixed: '#2e1500'
  on-primary-fixed-variant: '#6c3a00'
  secondary-fixed: '#e3e2e0'
  secondary-fixed-dim: '#c7c6c4'
  on-secondary-fixed: '#1b1c1b'
  on-secondary-fixed-variant: '#464746'
  tertiary-fixed: '#d4e3ff'
  tertiary-fixed-dim: '#b4c8e9'
  on-tertiary-fixed: '#061c35'
  on-tertiary-fixed-variant: '#354863'
  background: '#19120d'
  on-background: '#efe0d6'
  surface-variant: '#3c332d'
typography:
  display-lg:
    fontFamily: EB Garamond
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: EB Garamond
    fontSize: 28px
    fontWeight: '500'
    lineHeight: 34px
  headline-sm:
    fontFamily: EB Garamond
    fontSize: 22px
    fontWeight: '500'
    lineHeight: 28px
  body-lg:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Space Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-lg:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  price-display:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 24px
    letterSpacing: -0.01em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  touch-target: 48px
  margin-mobile: 20px
  gutter: 12px
  stack-sm: 4px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style
The design system embodies an **Industrial Luxury** aesthetic, specifically tailored for a premium mobile cafe ordering experience. It balances the cold, structural precision of high-end architecture with the warmth of a boutique lounge. The visual narrative is driven by **Glassmorphism**, using transparency and blur to create a sense of deep, atmospheric space.

The target audience is the discerning urban professional who values speed but expects a high-fidelity, tactile digital experience. The UI should evoke a sense of calm, exclusivity, and precision. We achieve this by contrasting a dark, moody environment with sharp, geometric typography and metallic accents that feel like physical hardware.

## Colors
The palette is rooted in a deep "Midnight Navy" foundation to establish a luxurious, low-light environment. 

- **Primary (Warm Bronze):** Used for critical actions, badges, and active states. It provides the "heat" in an otherwise cool environment.
- **Secondary (Chrome/Silver):** Used for iconography and subtle borders. It reinforces the industrial, metallic theme.
- **Surface (Glassmorphism):** The `#162A44` surface is applied with 40% opacity and a 16px-24px backdrop blur to create layered depth.
- **Background:** The core background is a solid `#0A1A2E` to ensure maximum contrast for the translucent layers above it.

## Typography
The typography system relies on a high-contrast pairing:
- **Serif (EB Garamond):** Used for product titles, section headers, and brand moments. It brings a "New York Editorial" feel to the cafe menu.
- **Sans-Serif (Space Grotesk):** Used for all functional data—descriptions, prices, and button labels. Its geometric nature complements the industrial theme and ensures legibility at small sizes on mobile devices.
- **Styling Note:** Use all-caps with generous tracking for `label-lg` to denote categories or micro-copy, mimicking industrial signage.

## Layout & Spacing
This design system utilizes a **Fluid Grid** model optimized for mobile-first interaction. 

- **Margins:** A consistent 20px horizontal margin ensures content doesn't bleed into the edges of modern mobile displays.
- **Touch Targets:** All interactive elements (buttons, selectors, toggles) must maintain a minimum height/width of 48px to satisfy accessibility and ease of use in a "on-the-go" cafe environment.
- **Vertical Rhythm:** Elements are stacked using an 8px base unit. Product cards in a list should have 16px spacing, while distinct sections should use 32px to provide breathing room.

## Elevation & Depth
Depth is not communicated through traditional drop shadows, but through **Tonal Stacked Glassmorphism**.

- **Level 1 (Background):** Solid `#0A1A2E`.
- **Level 2 (Cards/Containers):** `#162A44` at 40% opacity with a `24px` backdrop blur. A `0.5px` inner stroke of `#E5E4E2` (at 20% opacity) should be applied to define the edges against the dark background.
- **Level 3 (Popovers/Modals):** Same as Level 2 but with a slightly higher opacity (60%) and a more pronounced `1px` border of `#E5E4E2` to indicate physical proximity to the user.

## Shapes
To maintain the "Industrial" part of the narrative, shapes are kept **Soft (0.25rem - 0.75rem)**. 

- Avoid full circles (pills) except for very specific status indicators.
- **Buttons and Cards:** Use `rounded-lg` (0.5rem) to provide a modern feel that isn't too organic or "bubbly."
- **Input Fields:** Use `0.25rem` for a sharper, more architectural appearance.

## Components

- **Buttons:** 
  - *Primary:* Solid Bronze (`#CD7F32`) with dark navy text. No glass effect. High impact.
  - *Secondary:* Glass container with Silver (`#E5E4E2`) text and border.
- **Glass Chips:** Used for dietary labels (e.g., "Vegan," "Oat Milk"). These use the 40% opacity surface with silver text.
- **Bottom Cart Bar:** A persistent floating element at the bottom of the screen. It features a chrome (`#E5E4E2`) top-border accent (1px) and a high-blur glass background. The "View Cart" action inside is a Primary Bronze button.
- **Cards:** Product cards should have a subtle 0.5px silver border. Use the serif font for the item name and the geometric sans for the price, right-aligned or positioned clearly at the bottom-right.
- **Input Fields:** Bottom-bordered only (industrial/minimal) or fully enclosed in a low-opacity glass container for search bars.