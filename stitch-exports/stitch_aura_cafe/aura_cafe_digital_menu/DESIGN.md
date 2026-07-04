---
name: Aura Cafe Digital Menu
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
  secondary: '#c6c6c7'
  on-secondary: '#2f3132'
  secondary-container: '#454748'
  on-secondary-container: '#b5b5b6'
  tertiary: '#efbd8a'
  on-tertiary: '#472a03'
  tertiary-container: '#291500'
  on-tertiary-container: '#a47a4d'
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
  on-tertiary-fixed-variant: '#614018'
  background: '#00142c'
  on-background: '#d4e3ff'
  surface-variant: '#223550'
typography:
  display-lg:
    fontFamily: EB Garamond
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: EB Garamond
    fontSize: 32px
    fontWeight: '500'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: EB Garamond
    fontSize: 28px
    fontWeight: '500'
    lineHeight: '1.2'
  item-title:
    fontFamily: EB Garamond
    fontSize: 22px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.01em
  body-md:
    fontFamily: Space Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.1em
  price:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '500'
    lineHeight: '1'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  container-margin: 24px
  gutter: 16px
  stack-sm: 4px
  stack-md: 12px
  stack-lg: 32px
---

## Brand & Style
The design system for this digital menu embodies **Industrial Luxury**. It targets a high-end, urban demographic seeking a sophisticated culinary atmosphere. The interface evokes a sense of "prestige-utility"—merging the raw, technical precision of aerospace materials (chrome, navy, geometry) with the warmth of high-end hospitality (bronze, elegant serifs).

The visual style is **Glassmorphism with a Metallic Edge**. It utilizes deep, multi-layered translucency to create depth on dark surfaces. Elements should feel like machined parts set against a midnight sky, using "Chrome" as a structural accent and "Warm Bronze" as a beacon for call-to-actions and premium selections.

## Colors
The palette is rooted in a deep **Midnight Navy (#0A1A2E)** which serves as the canvas, providing a low-glare, premium background for night-time dining. 

- **Chrome (#C6C6C7):** Used for structural lines, borders, and icon details. It should be applied with subtle linear gradients (e.g., 45-degree angles) to simulate light hitting metal.
- **Warm Bronze (#D4A574):** Reserved strictly for highlighting: price points, "Chef's Specials," and primary selection buttons.
- **Glass Tint:** Semi-transparent layers use white or navy at 3-8% opacity to maintain legibility while allowing background gradients to bleed through.

## Typography
The typography system relies on the tension between the classical **EB Garamond** (representing the culinary heritage) and the technical **Space Grotesk** (representing the modern industrial venue).

- **Headlines:** Use EB Garamond for all category names and dish titles. It should feel editorial and prestigious.
- **Functional Text:** Use Space Grotesk for descriptions, ingredients, prices, and UI labels. The geometric nature of this font ensures high legibility on backlit screens.
- **Emphasis:** Prices should always be in Space Grotesk to maintain a clean, readable, and functional appearance amidst the decorative serif headings.

## Layout & Spacing
This design system uses a **Fluid Grid** with wide margins to create an "airy" luxury feel. 

- **Desktop/Tablet:** A 12-column grid with generous 32px gutters. Content should be centered with a max-width of 1200px to avoid eye-strain.
- **Mobile:** A 4-column grid with 24px side margins. Item cards should utilize vertical stacking to prioritize high-resolution food photography.
- **Rhythm:** Use a strict 8px baseline. Vertical spacing between menu categories should be significantly larger (48px+) than the spacing between items within a category (16px) to clearly define section breaks.

## Elevation & Depth
Depth is achieved through **Glassmorphism and Chrome Outlines** rather than traditional drop shadows.

- **Surface Layers:** The primary container uses a `backdrop-filter: blur(12px)` with a 5% white tint. 
- **Borders:** Every glass element must have a 1px "Chrome" border. Use a linear gradient for these borders (`top-left` to `bottom-right`) transitioning from #C6C6C7 to a darker #4A4A4A to mimic reflective metal.
- **Internal Glow:** For elevated states (active chips/cards), apply a subtle inner shadow or "rim light" in Bronze at 20% opacity to suggest the element is illuminated from within.

## Shapes
The shape language is **Soft (0.25rem - 0.75rem)**. While the "Industrial" theme might suggest sharp edges, the "Luxury" component requires tactile comfort.

- **Primary Cards:** 12px (rounded-lg) corner radius.
- **Buttons & Chips:** 8px (rounded) corner radius.
- **Input Fields:** 4px (soft) corner radius for a more technical, precise appearance.
- **Imagery:** Large dish photos should use the same 12px radius as cards to maintain a cohesive container logic.

## Components
- **Buttons:** Primary buttons use a **Chrome Gradient** background with dark navy text. The "Bronze" variant is reserved for "Order Now" or "Checkout." Buttons should have a subtle 1px metallic stroke.
- **Glass Chips:** Filter chips (e.g., "Vegan," "Gluten-Free") feature a transparent background with a 12px blur and a chrome border. When active, the border and text switch to Bronze.
- **Search Bar:** A dark, inset field using the Navy background but with a 1px Chrome border. The placeholder text should be a muted silver.
- **Menu Cards:** These consist of a blurred glass background. The price is anchored to the top right in Bronze. Descriptions are tucked under the title in Space Grotesk with 60% opacity.
- **Badges:** Small, rectangular labels (e.g., "Limited") using a solid Bronze background with Navy text, placed in the top-left corner of item images.