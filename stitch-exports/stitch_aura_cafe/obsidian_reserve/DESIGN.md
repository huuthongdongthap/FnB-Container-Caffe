---
name: Obsidian Reserve
colors:
  surface: '#051424'
  surface-dim: '#051424'
  surface-bright: '#2c3a4c'
  surface-container-lowest: '#010f1f'
  surface-container-low: '#0e1c2d'
  surface-container: '#122031'
  surface-container-high: '#1d2b3c'
  surface-container-highest: '#283647'
  on-surface: '#d5e4fa'
  on-surface-variant: '#d8c2b2'
  inverse-surface: '#d5e4fa'
  inverse-on-surface: '#233143'
  outline: '#a18d7f'
  outline-variant: '#534438'
  surface-tint: '#ffb779'
  primary: '#ffb779'
  on-primary: '#4c2700'
  primary-container: '#cd7f32'
  on-primary-container: '#432200'
  inverse-primary: '#8e4e00'
  secondary: '#c6c6c6'
  on-secondary: '#2f3131'
  secondary-container: '#454747'
  on-secondary-container: '#b5b5b5'
  tertiary: '#b8c8dc'
  on-tertiary: '#223241'
  tertiary-container: '#8393a6'
  on-tertiary-container: '#1c2c3b'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdcc1'
  primary-fixed-dim: '#ffb779'
  on-primary-fixed: '#2e1500'
  on-primary-fixed-variant: '#6c3a00'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c6'
  on-secondary-fixed: '#1a1c1c'
  on-secondary-fixed-variant: '#454747'
  tertiary-fixed: '#d4e4f9'
  tertiary-fixed-dim: '#b8c8dc'
  on-tertiary-fixed: '#0d1d2c'
  on-tertiary-fixed-variant: '#394859'
  background: '#051424'
  on-background: '#d5e4fa'
  surface-variant: '#283647'
typography:
  display-lg:
    fontFamily: Libre Caslon Text
    fontSize: 48px
    fontWeight: '400'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Libre Caslon Text
    fontSize: 32px
    fontWeight: '400'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Libre Caslon Text
    fontSize: 24px
    fontWeight: '400'
    lineHeight: '1.4'
  points-xl:
    fontFamily: Libre Caslon Text
    fontSize: 40px
    fontWeight: '400'
    lineHeight: '1'
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
  label-sm:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.1em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-padding-mobile: 20px
  container-padding-desktop: 64px
  gutter: 24px
  stack-sm: 12px
  stack-md: 24px
  stack-lg: 48px
---

## Brand & Style

The design system embodies "Industrial Luxury Noir," a synthesis of rugged precision and high-end exclusivity. It targets a high-net-worth audience who values technical sophistication and understated status. The aesthetic response should feel like a private lounge—dimly lit, high-fidelity, and secure.

The style leverages **Glassmorphism** for its primary interactive layers, creating a sense of depth and transparency over a void-like background. This is tempered by **Minimalist** layouts and **Tactile** accents, specifically chrome and bronze metallic highlights that ground the interface in physical luxury. The UI avoids bright lights in favor of glowing embers and polished surfaces.

## Colors

The palette is anchored in **Deep Dark Navy (#051424)**, serving as the foundational surface that mimics an obsidian stone or dark industrial steel. 

- **Bronze (#CD7F32):** Used exclusively for high-value actions, loyalty tier indicators, and points accumulation. It represents wealth and durability.
- **Chrome / Silver (#E0E0E0):** Employed for iconography, secondary UI details, and hairline borders to provide a metallic, technical contrast.
- **Surface Elevation:** We use a secondary navy (#0F1F2E) for container backgrounds to distinguish them from the base canvas.
- **Glass Accents:** White at 10% opacity is used for borders and subtle surface overlays to create the glassmorphic refraction effect.

## Typography

This design system utilizes a high-contrast typographic pairing. **Libre Caslon Text** (serving as a substitute for Cormorant Garamond for editorial flair) is used for "Loyalty Points," "Tier Status," and "Headlines." It brings an authoritative, literary elegance to the experience.

**Space Grotesk** handles all functional UI, navigation, and labels. Its geometric, slightly technical character reinforces the "Industrial" aspect of the brand. All labels should be set in uppercase with increased letter spacing to mimic engraved technical specifications.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy for desktop (12 columns) and a **Fluid Grid** for mobile. The vertical rhythm is governed by an 8px base unit. 

Spacing is generous to evoke a sense of "Luxury" through whitespace (or "darkspace"). Content is centered in large, breathable containers. On mobile, margins are tighter (20px) but maintain high internal padding within glass cards to ensure the background blur effect is visible and effective.

## Elevation & Depth

Hierarchy is established through **Glassmorphism** and **Chrome Outlines** rather than traditional shadows.

1.  **Level 0 (Base):** Deep Dark Navy (#051424).
2.  **Level 1 (Cards):** Semi-transparent layers with a 16px to 32px backdrop-blur. 
3.  **Level 2 (Active States):** Hairline borders (1px) using White at 10% or Bronze at 30%.
4.  **Interaction:** When an element is pressed, it should "recede" (slight scale down) rather than lift, emphasizing the industrial, heavy nature of the materials.

## Shapes

The design system uses a **Rounded (8px)** corner radius as the primary standard. This "Round Eight" approach softens the industrial coldness, making the interface feel more premium and ergonomic. 

- **Standard Buttons/Inputs:** 0.5rem (8px).
- **Featured Reward Cards:** 1rem (16px) for a more distinct, physical object feel.
- **Chrome Accents:** Hairline 1px borders follow the corner radius of their parent containers exactly.

## Components

- **Buttons:** Primary buttons are solid Bronze (#CD7F32) with black Space Grotesk text. Secondary buttons are "Ghost" style with a 1px Chrome border and backdrop-blur.
- **Loyalty Cards:** Use the most aggressive glassmorphism settings. Include a subtle "grain" texture overlay to simulate brushed metal or frosted glass.
- **Inputs:** Darker than the background (#030C16) with a bottom-only Chrome border that glows Bronze when focused.
- **Chips/Badges:** Small, pill-shaped elements with a 1px Bronze border and uppercase labels to denote "Platinum" or "Black" tier status.
- **Lists:** Separated by 1px dividers at 5% white opacity. Each list item should have a subtle hover state that increases the backdrop-blur intensity.
- **Progress Bars (Tier Tracking):** Thin 4px tracks in deep navy, with a glowing Bronze fill that features a metallic gradient.