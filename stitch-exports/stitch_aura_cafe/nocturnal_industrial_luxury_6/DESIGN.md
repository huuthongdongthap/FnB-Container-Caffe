---
name: Nocturnal Industrial Luxury
colors:
  surface: '#091421'
  surface-dim: '#091421'
  surface-bright: '#303a48'
  surface-container-lowest: '#050f1c'
  surface-container-low: '#121c2a'
  surface-container: '#16202e'
  surface-container-high: '#212b39'
  surface-container-highest: '#2b3544'
  on-surface: '#d9e3f6'
  on-surface-variant: '#c5c6cd'
  inverse-surface: '#d9e3f6'
  inverse-on-surface: '#27313f'
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
  tertiary: '#c4c7ca'
  on-tertiary: '#2d3134'
  tertiary-container: '#171a1d'
  on-tertiary-container: '#808386'
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
  tertiary-fixed: '#e0e2e6'
  tertiary-fixed-dim: '#c4c7ca'
  on-tertiary-fixed: '#191c1f'
  on-tertiary-fixed-variant: '#44474a'
  background: '#091421'
  on-background: '#d9e3f6'
  surface-variant: '#2b3544'
typography:
  display-lg:
    fontFamily: EB Garamond
    fontSize: 48px
    fontWeight: '500'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: EB Garamond
    fontSize: 32px
    fontWeight: '500'
    lineHeight: '1.2'
  headline-md:
    fontFamily: EB Garamond
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.2'
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  container-padding: 20px
---

## Brand & Style

The design system is engineered for the **Aura Cafe Referral Program**, targeting a sophisticated, night-owl demographic that values exclusivity and industrial craftsmanship. The brand personality is "Nocturnal Industrial Luxury"—a blend of high-end hospitality and raw, architectural precision.

The visual style is a specialized mix of **Glassmorphism** and **Sleek Industrialism**. It utilizes deep, atmospheric backgrounds contrasted against semi-transparent glass layers and "chrome" metallic accents. The UI should evoke the feeling of a dimly lit, upscale lounge—calm, prestigious, and highly tactile.

Key principles:
- **Atmospheric Depth:** Use layered transparency to create a sense of physical space.
- **Precision Accents:** Employ bronze and chrome details to highlight value and status.
- **Architectural Clarity:** Maintain high legibility through sharp functional typography and structured layouts.

## Colors

The palette is anchored in the night, using deep navy as the primary canvas to allow accent colors to glow with intent.

- **Primary (Deep Navy):** `#0A1A2E`. Used for the base canvas and deep structural layers.
- **Secondary (Bronze):** `#D4A574`. Reserved for rewards, call-to-action buttons, and referral status highlights.
- **Neutral/Chrome (Silver/Gray):** `#E5E7EB`. Used for borders, icons, and secondary text to provide a "machined" feel.
- **Surface:** `rgba(255, 255, 255, 0.03)`. The base for glass cards, allowing the background depth to bleed through.

## Typography

This design system utilizes a high-contrast typographic pairing to balance elegance with utility.

**EB Garamond** (serving as the substitute for Cormorant) is used for all "Statement" text—referral headlines, reward amounts, and section titles. It should be typeset with tight tracking and ample line-height to feel like a luxury editorial.

**Hanken Grotesk** handles the heavy lifting of the UI. It is used for instructional text, button labels, and data points. Labels should frequently use uppercase styling with slight letter-spacing to emphasize the industrial, "stamped" aesthetic.

## Layout & Spacing

This is a **Mobile-First** design system utilizing a fluid layout centered on a 4-column grid for mobile and an 8-column grid for tablet. 

The spacing rhythm is based on an 8px scale. To maintain the "Luxury" feel, use `lg` (40px) and `xl` (64px) vertical spacing between major sections to prevent the UI from feeling cramped.

**Layout Rules:**
- **Safe Zones:** 20px horizontal margins on all mobile views.
- **Card Spacing:** 16px gutter between stacked referral cards.
- **Touch Targets:** Minimum height of 48px for all interactive industrial elements.

## Elevation & Depth

Depth is conveyed through **Glassmorphism** and meticulous border treatments rather than traditional drop shadows.

- **Surface Layers:** All cards use a `backdrop-filter: blur(20px)` with a very subtle white tint (3% opacity).
- **Chrome Borders:** Elements are defined by a 1px solid or gradient border (`linear-gradient(135deg, #E5E7EB 0%, rgba(229, 231, 235, 0.2) 100%)`). This creates a "machined edge" that catches the light.
- **Glow Effects:** Primary buttons and reward indicators feature a subtle outer glow using the Bronze color (#D4A574) with a high blur (20px) and low opacity (15%).

## Shapes

The shape language follows a **Rounded** philosophy (Level 2), providing a refined and comfortable feel that softens the "cold" industrial materials. 

- **Standard Elements:** 0.5rem (8px) radius for input fields and small cards.
- **Large Containers:** 1rem (16px) radius for primary glass containers.
- **Status Pills:** Fully rounded (32px+) for tags such as "Earned" or "Pending."

## Components

### Buttons
- **Primary:** Bronze background (#D4A574) with dark navy text. Use a slight metallic gradient (top-to-bottom) to simulate a physical toggle.
- **Secondary (Chrome):** Transparent background with a 1px silver border and silver text.

### Referral Cards
- Semi-transparent glass background.
- Top border features a 1px "light leak" highlight.
- Content is strictly aligned to a left-justified industrial grid.

### Progress Indicators
- Used for tracking referral milestones. 
- Track: Dark navy with 10% opacity.
- Fill: Solid Bronze with a soft glow.

### Input Fields (Invite Codes)
- Dark, recessed background with a 1px chrome border on focus.
- Monospaced-style Hanken Grotesk for the invite code text to ensure character clarity.

### Chips/Badges
- Small, uppercase labels.
- Bronze version for "VIP" or "High Tier" status; Silver for standard status.