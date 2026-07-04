---
name: Nocturnal Industrial Luxury
colors:
  surface: '#16130f'
  surface-dim: '#16130f'
  surface-bright: '#3d3834'
  surface-container-lowest: '#110e0a'
  surface-container-low: '#1f1b17'
  surface-container: '#231f1b'
  surface-container-high: '#2e2925'
  surface-container-highest: '#393430'
  on-surface: '#eae1db'
  on-surface-variant: '#d4c4b7'
  inverse-surface: '#eae1db'
  inverse-on-surface: '#34302c'
  outline: '#9c8e82'
  outline-variant: '#50453b'
  surface-tint: '#efbd8a'
  primary: '#f2c08d'
  on-primary: '#472a03'
  primary-container: '#d4a574'
  on-primary-container: '#5b3a13'
  inverse-primary: '#7c572d'
  secondary: '#c7c6c4'
  on-secondary: '#303130'
  secondary-container: '#464746'
  on-secondary-container: '#b5b5b3'
  tertiary: '#a5d0e6'
  on-tertiary: '#003547'
  tertiary-container: '#8ab4ca'
  on-tertiary-container: '#194659'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdcbc'
  primary-fixed-dim: '#efbd8a'
  on-primary-fixed: '#2c1700'
  on-primary-fixed-variant: '#614018'
  secondary-fixed: '#e3e2e0'
  secondary-fixed-dim: '#c7c6c4'
  on-secondary-fixed: '#1b1c1b'
  on-secondary-fixed-variant: '#464746'
  tertiary-fixed: '#bfe8ff'
  tertiary-fixed-dim: '#a2cde3'
  on-tertiary-fixed: '#001f2a'
  on-tertiary-fixed-variant: '#204c5f'
  background: '#16130f'
  on-background: '#eae1db'
  surface-variant: '#393430'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
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
  label-xl:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 24px
    letterSpacing: 0.05em
  label-md:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  mono-ui:
    fontFamily: Space Grotesk
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 32px
  xl: 48px
  gutter: 20px
  margin-edge: 24px
---

## Brand & Style
The design system for this POS terminal evokes the atmosphere of a high-end, dimly lit urban lounge. It focuses on **Nocturnal Industrial Luxury**, targeting premium hospitality environments where the hardware should blend seamlessly into sophisticated interiors. 

The aesthetic combines the raw, structural honesty of industrial design with the polished refinement of luxury. The UI prioritizes high-contrast legibility in low-light environments, utilizing **Glassmorphism** to create depth and a sense of physical layering. This approach ensures the interface feels like a high-tech tool rather than a generic tablet app, projecting an image of efficiency, exclusivity, and precision.

## Colors
The palette is rooted in deep, nocturnal tones to reduce eye strain during long shifts in dark environments. 

- **Primary (Bronze):** Reserved for the most critical actions: "Pay," "Total," and "Confirm." It represents the "warmth" of the hospitality service.
- **Secondary (Chrome/Silver):** Used for secondary interactions, utility icons, and subtle gradients that mimic metallic textures.
- **Surface Tiers:** 
    - The base layer uses the deepest Navy for maximum contrast.
    - `Surface-Container` is used for persistent sidebar or order-list areas.
    - `Surface-Bright` highlights interactive card elements or active selection states.

## Typography
**Space Grotesk** is used across all levels to maintain a technical, geometric edge that complements the industrial aesthetic. 

- **Numerical Data:** Totals and quantities should utilize the `label-xl` or `display-lg` roles for immediate recognition.
- **Readability:** Because of the geometric nature of the font, ample letter spacing is applied to labels to prevent character crowding on high-resolution terminal screens.
- **Hierarchy:** Bold weights are strictly reserved for monetary values and primary navigation headers.

## Layout & Spacing
The layout uses a **Fluid Grid** model designed for high-precision touch targets. The terminal interface is divided into functional zones:

1.  **Global Navigation (Left/Top):** Constant access to tables, menu, and settings.
2.  **Order List (Side Panel):** A persistent vertical list showing current selections.
3.  **Menu Grid (Center):** A responsive grid of item cards.

Spacings are based on a 4px baseline, but touch targets (buttons, list items) must never be smaller than 48px in height. Visual breathing room is maintained through generous `lg` (32px) margins at the edges of the screen to prevent accidental touches near the bezel.

## Elevation & Depth
This design system utilizes **Glassmorphism** as its primary method of establishing hierarchy. 

- **Surface Layers:** Backgrounds use the `Surface-Container` Navy.
- **Glass Cards:** Cards and modals feature a backdrop-filter (blur: 20px) and a semi-transparent fill (`rgba(27, 43, 62, 0.7)`).
- **Industrial Borders:** Instead of soft shadows, depth is communicated via thin, 1px "Chrome" strokes (`#E5E4E2` at 15% opacity).
- **Active State:** Elements being interacted with increase in brightness and receive a subtle Bronze outer glow (0px 0px 12px) to simulate a physical LED backlight.

## Shapes
The shape language is **"Sharp-ish"** to reflect the industrial nature of the brand.

- **Standard Elements:** Buttons and cards use a 4px (`0.25rem`) corner radius.
- **Large Containers:** Modals and main panel groups use an 8px (`0.5rem`) radius.
- **Icons:** Must be linear, using 1.5px or 2px strokes with sharp or slightly clipped joins to match the typography.

## Components
- **Buttons:** 
  - *Primary:* Solid Bronze background with black text for maximum contrast. 
  - *Secondary:* Transparent with a Chrome stroke and Glassmorphic blur.
- **Menu Cards:** Feature a background image with a dark overlay. The name and price are anchored at the bottom on a Glassmorphic plate.
- **Order List Items:** Subtle dividers using the Chrome/Silver color at 10% opacity. Active items are highlighted with a vertical Bronze bar on the left edge.
- **Chips (Categories):** Low-profile, sharp-cornered containers. Active category chips use a Chrome gradient fill.
- **Input Fields:** Inset appearance with a 1px `Surface-Bright` stroke that turns Bronze on focus.
- **Keypad:** High-contrast buttons with large `Space Grotesk` numerals; the "Enter" or "Pay" key is always the largest Bronze element.