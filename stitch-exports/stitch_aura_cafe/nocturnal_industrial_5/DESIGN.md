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
  secondary: '#efbd8a'
  on-secondary: '#472a03'
  secondary-container: '#64421a'
  on-secondary-container: '#dfaf7e'
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
  secondary-fixed: '#ffdcbc'
  secondary-fixed-dim: '#efbd8a'
  on-secondary-fixed: '#2c1700'
  on-secondary-fixed-variant: '#614018'
  tertiary-fixed: '#dde3eb'
  tertiary-fixed-dim: '#c1c7cf'
  on-tertiary-fixed: '#161c22'
  on-tertiary-fixed-variant: '#41474e'
  background: '#081425'
  on-background: '#d8e3fb'
  surface-variant: '#2a3548'
typography:
  headline-xl:
    fontFamily: EB Garamond
    fontSize: 64px
    fontWeight: '500'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: EB Garamond
    fontSize: 48px
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
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Space Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.1em
  headline-lg-mobile:
    fontFamily: EB Garamond
    fontSize: 36px
    fontWeight: '500'
    lineHeight: '1.2'
spacing:
  unit: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 20px
  margin-desktop: 64px
---

## Brand & Style
The design system embodies the atmosphere of a premium container cafe at night—architectural, sophisticated, and moody. It targets an urban, design-conscious audience that values exclusive, late-night social experiences. 

The visual style is a fusion of **Industrial Glassmorphism** and **Nocturnal Minimalism**. It leverages deep-sea depths and metallic reflections to create a sense of mystery and high-end craftsmanship. The interface mimics the physical materials of the cafe: cold steel frames, frosted glass partitions, and the warm, amber glow of filament bulbs.

## Colors
The palette is centered on a deep, nocturnal foundation with high-contrast metallic accents.

- **Primary (#0A1A2E):** A dense Dark Navy used for the base environment and deep backgrounds.
- **Secondary (#D4A574):** Warm Bronze, used exclusively for primary calls-to-action, highlights, and critical interaction points, mimicking the warmth of interior lighting.
- **Chrome & Silver-Blue:** Used for structural elements, borders, and glass reflections. These are applied via gradients rather than flat fills to simulate metal.
- **Functional Accents:** Low-opacity Silver-Blue (#94A3B8 at 20%) is used for container backgrounds to achieve the frosted glass effect.

## Typography
The typography strategy contrasts the classical elegance of the cafe's heritage with its industrial construction.

- **Headlines:** Use EB Garamond (as a compatible alternative to Cormorant) for all large display text. It should feel literary and premium. Keep tracking tight on larger sizes to maintain a sophisticated silhouette.
- **Body & Technical Info:** Use Space Grotesk for all functional text, menus, and descriptions. Its geometric, slightly technical character reinforces the "container" industrial aesthetic.
- **Labels:** Small labels and prices should be set in uppercase Space Grotesk with generous letter spacing to evoke architectural blueprints.

## Layout & Spacing
The layout follows a **Rigid Grid** philosophy, reflecting the structural integrity of shipping containers. 

- **Grid:** Use a 12-column grid for desktop with wide 24px gutters. Elements should feel "slotted" into the grid.
- **Margins:** Generous outer margins (64px+) on desktop create an exclusive, gallery-like feel, preventing the UI from feeling crowded.
- **Rhythm:** All vertical spacing must be multiples of 8px. Use larger gaps (80px, 120px) between sections to allow the dark background to "breathe" and enhance the nocturnal mood.

## Elevation & Depth
Depth is achieved through material simulation rather than traditional drop shadows.

- **Base Layer:** Solid #0A1A2E.
- **Glass Layer:** Semi-transparent surfaces using a `backdrop-filter: blur(12px)` and a subtle 1px solid border. The border should use a linear gradient from #94A3B8 (top-left) to transparent (bottom-right).
- **Chrome Accents:** Use thin, high-contrast silver borders (0.5px to 1px) to define the "edges" of the container structures.
- **Glow:** Primary interaction points (like active buttons) should have a soft Bronze outer glow (`box-shadow: 0 0 20px rgba(212, 165, 116, 0.3)`) to simulate the cast of a warm lamp.

## Shapes
In line with the industrial container theme, this design system uses **Sharp (0px)** corners for all structural elements. 

- **Structural Elements:** Buttons, input fields, and cards must have square corners to mimic the hard edges of steel beams and glass panes.
- **Exceptions:** Icons may contain curves for legibility, but they should be housed within square containers or frames.

## Components

### Buttons
- **Primary:** Bronze fill (#D4A574), black text, sharp corners. On hover, apply a subtle metallic gradient and a soft bronze outer glow.
- **Secondary:** Transparent background, 1px chrome border, silver-blue text. 
- **Ghost:** No border, Space Grotesk caps, underline on hover.

### Cards & Containers
- Cards should utilize the **Glassmorphism** effect: 15% opacity silver-blue fill with a 12px background blur. 
- Top-level containers should have a 1px "Chrome" top-border to suggest a metallic cap.

### Input Fields
- Dark, recessed backgrounds (black at 30% opacity).
- Bottom-border only (1px silver) to maintain a minimalist, architectural look.
- Active state: Border transitions to Bronze (#D4A574).

### Selection Controls
- **Checkboxes/Radios:** Sharp-edged squares. Active state is a solid Bronze fill with a black checkmark.
- **Chips:** Small, sharp-edged rectangles with a low-opacity silver-blue background, used for coffee categories or flavor profiles.

### Lists
- Use horizontal dividers that don't span the full width, mimicking the structural ribs of a container. Dividers should be 1px thick and low-contrast (#1E293B).