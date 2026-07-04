---
name: Nocturnal Industrial
colors:
  surface: '#09141e'
  surface-dim: '#09141e'
  surface-bright: '#2f3a46'
  surface-container-lowest: '#040f19'
  surface-container-low: '#111d27'
  surface-container: '#15212b'
  surface-container-high: '#202b36'
  surface-container-highest: '#2b3641'
  on-surface: '#d8e4f2'
  on-surface-variant: '#d5c3b9'
  inverse-surface: '#d8e4f2'
  inverse-on-surface: '#26313d'
  outline: '#9d8e85'
  outline-variant: '#51443d'
  surface-tint: '#f2bb98'
  primary: '#f2bb98'
  on-primary: '#49280f'
  primary-container: '#c49271'
  on-primary-container: '#4e2c12'
  inverse-primary: '#7f5538'
  secondary: '#c6c6cf'
  on-secondary: '#2f3037'
  secondary-container: '#45464e'
  on-secondary-container: '#b4b4bd'
  tertiary: '#b8c8dc'
  on-tertiary: '#233242'
  tertiary-container: '#8f9eb2'
  on-tertiary-container: '#273546'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdcc6'
  primary-fixed-dim: '#f2bb98'
  on-primary-fixed: '#301401'
  on-primary-fixed-variant: '#643e23'
  secondary-fixed: '#e2e1eb'
  secondary-fixed-dim: '#c6c6cf'
  on-secondary-fixed: '#1a1b22'
  on-secondary-fixed-variant: '#45464e'
  tertiary-fixed: '#d4e4f9'
  tertiary-fixed-dim: '#b8c8dc'
  on-tertiary-fixed: '#0d1d2c'
  on-tertiary-fixed-variant: '#394859'
  background: '#09141e'
  on-background: '#d8e4f2'
  surface-variant: '#2b3641'
typography:
  display-accent:
    fontFamily: EB Garamond
    fontSize: 48px
    fontWeight: '400'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.2'
  body-lg:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Space Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.1em
  price-display:
    fontFamily: EB Garamond
    fontSize: 22px
    fontWeight: '500'
    lineHeight: '1'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 20px
  gutter: 12px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style
The design system embodies an **Industrial Luxury** aesthetic, specifically tailored for a high-end, late-night café atmosphere. It targets a discerning, tech-savvy clientele that appreciates precision and tactile elegance. 

The visual narrative blends **Glassmorphism** with **Technical Minimalism**. The UI should feel like a high-end physical interface—cool to the touch, illuminated by subtle internal lighting, and built with metallic precision. The goal is to evoke a sense of "nocturnal ambiance," where the interface recedes into the dark background, allowing highlighted menu items and metallic accents to shine with premium clarity.

## Colors
The palette is rooted in the "Deepest Nocturnal Navy," serving as the void upon which the UI is built. 

- **Primary (Bronze Metallic):** Used for critical calls to action, price points, and active states. It mimics the warmth of brushed bronze or copper.
- **Secondary (Chrome/Steel):** A cool-toned silver-grey used for secondary information, icons, and technical borders.
- **Surface (Translucent Glass):** Surfaces are not solid colors but layers of the background with 40-60% opacity and high-intensity backdrop blurs (20px+).
- **Background:** A monolithic #05101a to ensure maximum contrast for the glass and metallic elements.

## Typography
This design system utilizes a high-contrast typographic pairing to reinforce the "Industrial Luxury" theme.

- **Space Grotesk:** Acts as the workhorse for all functional elements. Its geometric and technical nature supports the industrial aesthetic, providing clarity for menu descriptions and navigation.
- **EB Garamond (System Substitute for Cormorant):** Reserved strictly for "Moments of Elegance"—prices, large display numbers, and special category headers. Its refined serifs provide a human, high-end counterpoint to the technical sans-serif.
- **Hierarchy:** Use all-caps labels for technical data (e.g., caffeine content, origin) to mimic industrial spec sheets.

## Layout & Spacing
The layout is optimized for a **single-column mobile flow**, prioritizing thumb-reach and visual immersion. 

- **The Grid:** A 4-column fluid mobile grid with 20px outer margins.
- **Rhythm:** A strict 4px baseline grid ensures technical precision. 
- **Density:** High-density content (like ingredient lists) is balanced by generous vertical spacing between major menu cards to maintain a "premium" feel. 
- **Safe Areas:** Account for bottom-anchored mobile navigators, using glassmorphic blurs to allow content to scroll behind the navigation bar without losing legibility.

## Elevation & Depth
Depth is created through **Material Stacking** rather than traditional shadows.

1. **The Void (Base):** The darkest nocturnal navy.
2. **The Glass (Mid):** Translucent cards with a 1px "Chrome" (#a1a1aa) border at 20% opacity. These utilize `backdrop-filter: blur(24px)` to pull color from underlying imagery.
3. **The Light (High):** Primary buttons and active states use a subtle inner glow or "rim light" effect to look like illuminated controls.
4. **Shadows:** When used, shadows are highly diffused and tinted with the primary bronze color (#c49271) at extremely low opacity (10%) to simulate a warm glow hitting the dark surface.

## Shapes
The shape language combines technical sharpness with organic softness.

- **Cards:** Use `rounded-xl` (24px) to create a soft, inviting container that contrasts with the industrial fonts.
- **Buttons/Inputs:** Use a medium `rounded-lg` (12px) for a more precise, "machined" look.
- **Details:** Use 1px solid lines for dividers, mimicking the fine markings on a precision instrument.

## Components
- **Menu Cards:** Glassmorphic backgrounds with 24px corner radius. Features a top-right "Price Accent" using EB Garamond.
- **Primary Buttons:** Solid Bronze (#c49271) with white or dark-navy text. Include a subtle metallic gradient (top-to-bottom) to suggest a 3D physical button.
- **Ghost Buttons:** 1px "Chrome" (#a1a1aa) border with Space Grotesk text in all-caps.
- **Chips/Tags:** Small, pill-shaped outlines used for dietary restrictions (e.g., VEGAN, GF), using the `label-caps` typography style.
- **Inputs:** Darker translucent fills with a bright, 1px bottom-border that illuminates (changes to Bronze) upon focus.
- **Lists:** Clean, borderless rows separated by 1px "Steel" dividers at 10% opacity.