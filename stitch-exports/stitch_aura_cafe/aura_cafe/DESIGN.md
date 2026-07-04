---
name: Aura Cafe
colors:
  surface: '#021429'
  surface-dim: '#021429'
  surface-bright: '#293a51'
  surface-container-lowest: '#000e22'
  surface-container-low: '#091c32'
  surface-container: '#0e2036'
  surface-container-high: '#192b41'
  surface-container-highest: '#25364d'
  on-surface: '#d4e3ff'
  on-surface-variant: '#c4c6ce'
  inverse-surface: '#d4e3ff'
  inverse-on-surface: '#203148'
  outline: '#8e9198'
  outline-variant: '#44474d'
  surface-tint: '#b5c8e7'
  primary: '#b5c8e7'
  on-primary: '#1e314a'
  primary-container: '#00142c'
  on-primary-container: '#6d7f9c'
  inverse-primary: '#4d5f7b'
  secondary: '#c7c6c4'
  on-secondary: '#303130'
  secondary-container: '#464746'
  on-secondary-container: '#b5b5b3'
  tertiary: '#ffb779'
  on-tertiary: '#4c2700'
  tertiary-container: '#230f00'
  on-tertiary-container: '#b76d20'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d4e3ff'
  primary-fixed-dim: '#b5c8e7'
  on-primary-fixed: '#071c34'
  on-primary-fixed-variant: '#354862'
  secondary-fixed: '#e3e2e0'
  secondary-fixed-dim: '#c7c6c4'
  on-secondary-fixed: '#1b1c1b'
  on-secondary-fixed-variant: '#464746'
  tertiary-fixed: '#ffdcc1'
  tertiary-fixed-dim: '#ffb779'
  on-tertiary-fixed: '#2e1500'
  on-tertiary-fixed-variant: '#6c3a00'
  background: '#021429'
  on-background: '#d4e3ff'
  surface-variant: '#25364d'
typography:
  display-lg:
    fontFamily: Libre Caslon Text
    fontSize: 48px
    fontWeight: '400'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Libre Caslon Text
    fontSize: 36px
    fontWeight: '400'
    lineHeight: 44px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Libre Caslon Text
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 40px
  item-title:
    fontFamily: Libre Caslon Text
    fontSize: 20px
    fontWeight: '400'
    lineHeight: 28px
  body-lg:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '300'
    lineHeight: 28px
  body-md:
    fontFamily: Space Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.1em
  mono-ui:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
spacing:
  unit: 4px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
  container-max: 1280px
---

## Brand & Style

The design system embodies "Industrial Luxury"—a fusion of high-end hospitality and precision engineering. It targets a sophisticated audience seeking an atmospheric, exclusive experience that feels both raw and refined. 

The visual style is a meticulous blend of **Glassmorphism** and **Minimalism**, set against a deep, void-like backdrop. UI elements should feel like high-grade instrumentation: machined metal, crystalline glass, and warm, tactile indicators. The emotional goal is to evoke a sense of calm, nocturnal elegance where every interaction feels deliberate and high-quality.

## Colors

The palette is anchored by a deep navy foundation, creating a high-contrast stage for metallic accents.

- **Primary (#00142C):** The "Deep Midnight" used for the main background. It should feel infinite and immersive.
- **Secondary (#E5E4E2):** "Chrome Silver." Used for borders, icons, and primary text to simulate light reflecting off polished metal.
- **Tertiary (#CD7F32):** "Burnished Bronze." Reserved for status badges, highlights, and secondary calls to action to provide warmth and focus.
- **Neutral (#0F2137):** A slightly lighter navy used for surface layers and container backgrounds to differentiate depth from the base floor.

## Typography

This design system utilizes a high-contrast typographic pairing to reinforce the "Industrial Luxury" narrative.

- **Libre Caslon Text** (substituting for Cormorant Garamond style): Used for all editorial content, menu item names, and large headlines. It brings a classic, literary elegance and human warmth to the interface.
- **Space Grotesk**: Used for all technical data, descriptions, price tags, and UI navigation. Its geometric, slightly tech-leaning construction provides the "industrial" balance.

Headlines should utilize generous tracking for a premium feel, while labels should be tightly structured and often set in uppercase to mimic technical blueprints.

## Layout & Spacing

The layout philosophy follows a **Fixed Grid** model on desktop to maintain a gallery-like presentation, transitioning to a fluid model on mobile. 

The rhythm is built on a 4px base unit, but emphasizes large, "breathable" negative space to signify luxury. 
- **Desktop:** 12-column grid with 64px side margins. 
- **Tablet:** 8-column grid with 32px side margins.
- **Mobile:** 4-column grid with 16px side margins.

Sections should be separated by clear, thin Chrome (#E5E4E2) horizontal rules to maintain the "engineered" feel. Padding within glass containers should be generous (minimum 32px) to prevent the content from feeling cramped.

## Elevation & Depth

Depth is achieved through material properties rather than traditional drop shadows.

1.  **The Void:** The base background level (#00142C).
2.  **The Glass Layer:** Elevated containers use a semi-transparent fill of the primary color (80% opacity) with a `backdrop-blur` of 12px to 20px.
3.  **The Chrome Edge:** Instead of shadows, use a 0.5px solid border in Secondary (#E5E4E2) at 30% opacity to define the silhouette of elevated components.
4.  **The Active Glow:** Interactive elements may emit a subtle, low-spread outer glow in Bronze (#CD7F32) when focused, simulating a powered-on indicator light.

## Shapes

To maintain the precision-engineered aesthetic, this design system uses **Sharp (0)** roundedness. 

Right angles dominate the UI to reflect architectural blueprints and industrial machinery. Circles are permitted only for specific functional indicators (like status pips or circular icon buttons) to provide a stark, geometric contrast against the dominant rectangular grid.

## Components

- **Buttons:** Primary buttons feature a solid Chrome (#E5E4E2) background with navy text in Space Grotesk. Secondary buttons use a transparent background with a 1px Chrome border.
- **Chips & Badges:** Badges for "Limited Edition" or "Specialty" items use the Burnished Bronze (#CD7F32) background with black text for maximum visibility.
- **Input Fields:** Bottom-border only (1px Chrome). Focus state changes the border to Bronze with a subtle 4px blur glow.
- **Cards:** Glassmorphic panels with no rounded corners. Content should be strictly aligned to the internal grid of the card.
- **Lists:** Menu lists are separated by thin 0.5px Chrome lines. Item names are Libre Caslon Text (Regular/Italic), while prices are Space Grotesk (Medium).
- **Special Component - The "Aura Gauge":** A thin horizontal progress bar used for item availability or strength (e.g., caffeine levels), utilizing the Bronze accent color.