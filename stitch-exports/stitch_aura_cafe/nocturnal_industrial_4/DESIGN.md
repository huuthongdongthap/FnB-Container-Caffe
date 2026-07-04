---
name: Aura Industrial Noir
colors:
  surface: '#00142b'
  surface-dim: '#00142b'
  surface-bright: '#283a53'
  surface-container-lowest: '#000f22'
  surface-container-low: '#071c33'
  surface-container: '#0c2038'
  surface-container-high: '#182b43'
  surface-container-highest: '#23364e'
  on-surface: '#d3e3ff'
  on-surface-variant: '#c5c6cd'
  inverse-surface: '#d3e3ff'
  inverse-on-surface: '#1e3149'
  outline: '#8e9097'
  outline-variant: rgba(198, 198, 199, 0.15)
  surface-tint: '#b8c7e2'
  primary: '#d4e3ff'
  on-primary: '#223146'
  primary-container: '#b8c7e2'
  on-primary-container: '#45536a'
  inverse-primary: '#515f76'
  secondary: '#c6c6c7'
  on-secondary: '#2f3132'
  secondary-container: '#454748'
  on-secondary-container: '#b5b5b6'
  tertiary: '#ffdcbb'
  on-tertiary: '#482a03'
  tertiary-container: '#efbd8a'
  on-tertiary-container: '#6f4b22'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d4e3ff'
  primary-fixed-dim: '#b8c7e2'
  on-primary-fixed: '#0c1c30'
  on-primary-fixed-variant: '#39475e'
  secondary-fixed: '#e3e2e3'
  secondary-fixed-dim: '#c6c6c7'
  on-secondary-fixed: '#1a1c1d'
  on-secondary-fixed-variant: '#454748'
  tertiary-fixed: '#ffdcbc'
  tertiary-fixed-dim: '#efbd8a'
  on-tertiary-fixed: '#2c1700'
  on-tertiary-fixed-variant: '#623f17'
  background: '#00142b'
  on-background: '#d3e3ff'
  surface-variant: '#23364e'
  surface-glass: rgba(18, 37, 61, 0.6)
  surface-glass-heavy: rgba(25, 45, 75, 0.8)
  neon-bronze: '#d4a574'
typography:
  display-lg:
    fontFamily: EB Garamond
    fontSize: 80px
    fontWeight: '500'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: EB Garamond
    fontSize: 36px
    fontWeight: '500'
    lineHeight: '1.2'
  headline-md:
    fontFamily: EB Garamond
    fontSize: 32px
    fontWeight: '400'
    lineHeight: '1.3'
  headline-sm:
    fontFamily: EB Garamond
    fontSize: 24px
    fontWeight: '400'
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
  label-md:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.0'
    letterSpacing: 0.1em
  label-sm:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.0'
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  xs: 4px
  base: 8px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  margin: 32px
  gutter: 24px
---

## Brand & Style
The brand personality is **Industrial Luxury**, characterized by a sophisticated, nocturnal aesthetic that blends raw structural elements with premium comfort. It targets a discerning "sophisticated coffee connoisseur" who appreciates the intersection of architecture and atmosphere.

The design style is a hybrid of **Glassmorphism** and **Minimalist Brutalism**. It utilizes frosted translucent layers, heavy backdrop blurs, and metallic accents (bronze and chrome) to create a high-end "sanctum" feel. The emotional response should be one of "nocturnal calm"—exclusive, quiet, and precisely engineered.

## Colors
The palette is rooted in a deep **Midnight Navy (#00142b)** background, which serves as the canvas for industrial metallic highlights. 

- **Primary (Steel Blue):** Used for active states and subtle branding elements.
- **Secondary (Cool Chrome):** Used for utilitarian text, borders, and secondary buttons.
- **Tertiary (Warm Bronze):** The primary accent color, used for calls to action, high-priority labels, and "neon" glowing effects.
- **Surface Strategy:** Instead of solid fills, depth is created through varying opacity glass layers (`surface-glass`). These layers interact with the dark background to simulate structural depth.

## Typography
The typography pairing contrasts the classical, romantic elegance of **EB Garamond** with the technical, futuristic precision of **Space Grotesk**.

- **EB Garamond** is reserved for high-impact display moments, often utilizing *italics* to soften the industrial grid.
- **Space Grotesk** is used for all functional roles, emphasizing the brand's "technical" and "engineered" roots. 
- **Labeling:** All labels should be in uppercase with generous letter spacing to evoke a sense of architectural signage.

## Layout & Spacing
The layout uses a **Fixed Grid** philosophy with a maximum content width of 1200px. 

- **Grid:** A 12-column system is used for complex layouts (like the "Bento" section), while a standard vertical stack with `xl` (80px) padding defines major section breaks.
- **Margins:** 32px safe-area margins are maintained on all screen sizes to ensure the content never feels cramped.
- **The Metal Seam:** Horizontal and vertical divisions should use 0.5px borders with low opacity to simulate the welded seams of shipping containers.

## Elevation & Depth
Hierarchy is conveyed through **Glassmorphism and Tonal Layers** rather than traditional shadows.

- **Level 1 (Base):** Midnight Navy (#00142b).
- **Level 2 (Panels):** `surface-glass` (60% opacity) with a 12px backdrop blur and a thin `outline-variant` border.
- **Level 3 (Heavy Modals/Hero Cards):** `surface-glass-heavy` (80% opacity) with a 20px blur.
- **Glow Effects:** The primary "depth" indicator for interactivity is the `neon-glow-bronze` box shadow, which simulates light reflecting off a dark metallic surface.

## Shapes
The shape language is primarily **Industrial & Angular**. 

- **Containers:** Most panels use sharp or slightly softened corners (0.25rem) to mimic the rigid structure of a shipping container.
- **Special Elements:** Only highly interactive or "organic" elements like reservation buttons and status pips use `rounded-full`. 
- **The Contrast:** Large image blocks should be housed within sharp-edged containers to maintain the architectural integrity of the layout.

## Components
- **Buttons:** 
  - *Primary (Bronze):* Sharp corners, uppercase tracking, `neon-glow-bronze` shadow.
  - *Secondary (Steel):* Transparent background, 1px border in `secondary`, no shadow.
  - *Action (Reservation):* Pill-shaped to stand out as a distinct utility.
- **Cards (Glass Panels):** Use `surface-glass` with a 1px `outline-variant`. Headers within cards should use `headline-sm` in EB Garamond Italics.
- **Interactive Menu Items:** Hover states should transition the border color from transparent/muted to `tertiary/50` and scale the internal image slightly (1.05x).
- **Decorative Accents:** Use the "Metal Seam" (a vertical or horizontal 0.5px line) and "Status Pips" (pulsing circles) to add technical detail.