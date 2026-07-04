---
name: Nocturnal Industrial
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
  on-surface-variant: '#d4c4b7'
  inverse-surface: '#d4e3ff'
  inverse-on-surface: '#1e314b'
  outline: '#9c8e82'
  outline-variant: '#50453b'
  surface-tint: '#efbd8a'
  primary: '#f2c08d'
  on-primary: '#472a03'
  primary-container: '#d4a574'
  on-primary-container: '#5b3a13'
  inverse-primary: '#7c572d'
  secondary: '#b8c7e2'
  on-secondary: '#223146'
  secondary-container: '#39475e'
  on-secondary-container: '#a7b6d0'
  tertiary: '#c7c9cd'
  on-tertiary: '#2d3134'
  tertiary-container: '#abaeb2'
  on-tertiary-container: '#3e4245'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdcbc'
  primary-fixed-dim: '#efbd8a'
  on-primary-fixed: '#2c1700'
  on-primary-fixed-variant: '#614018'
  secondary-fixed: '#d4e3ff'
  secondary-fixed-dim: '#b8c7e2'
  on-secondary-fixed: '#0c1c30'
  on-secondary-fixed-variant: '#39475e'
  tertiary-fixed: '#e0e2e6'
  tertiary-fixed-dim: '#c4c7ca'
  on-tertiary-fixed: '#191c1f'
  on-tertiary-fixed-variant: '#44474a'
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
  display-lg-mobile:
    fontFamily: EB Garamond
    fontSize: 36px
    fontWeight: '600'
    lineHeight: '1.1'
  headline-md:
    fontFamily: EB Garamond
    fontSize: 32px
    fontWeight: '500'
    lineHeight: '1.2'
  headline-sm:
    fontFamily: EB Garamond
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.3'
  body-lg:
    fontFamily: EB Garamond
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: EB Garamond
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-caps:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.1em
  label-mono:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.4'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1200px
  gutter: 24px
  margin-mobile: 20px
  stack-sm: 12px
  stack-md: 32px
  stack-lg: 64px
---

## Brand & Style
The design system embodies "Nocturnal Industrial Luxury," a narrative of exclusive, after-hours hospitality. It targets a discerning audience that appreciates the intersection of raw architectural elements and high-end finishings. 

The aesthetic is characterized by:
- **Sophisticated Darkness:** A deep, immersive foundation that feels private and premium.
- **Industrial Precision:** Clean lines, structured grids, and "hardware" inspired details like chrome accents and technical labels.
- **Glassmorphism & Chrome:** The UI uses layered transparency to simulate frosted glass partitions, accented by hyper-realistic metallic borders to create a sense of tangible value.
- **High Contrast:** Strategic use of bronze and brilliant white against dark navy to guide the eye toward conversion points and rewards.

## Colors
The palette is rooted in the depth of night and the warmth of premium metals.

- **Primary (Bronze - #D4A574):** Used for calls to action, progress indicators, and "gold-tier" status. It provides a warm, tactile contrast to the cool background.
- **Secondary (Dark Navy - #0A1A2E):** The canvas. This is the base "void" color that provides the high-contrast foundation for all elements.
- **Surface (Midnight - #162A44):** A slightly lighter navy used for card backgrounds and elevated containers to create depth within the dark theme.
- **Chrome (#A8B2BD):** A cool, metallic grey used for subtle borders, icons, and dividers to reinforce the industrial aesthetic.

## Typography
This design system utilizes **EB Garamond** (as a high-quality alternative for both headlines and body text to maintain editorial cohesion) paired with a technical sans-serif for functional labels.

- **Headlines:** Set in EB Garamond with tight tracking and aggressive line heights to evoke luxury editorial design.
- **Body:** EB Garamond provides a warm, readable, and "literary" feel, contrasting against the cold industrial UI elements.
- **Functional Labels:** A secondary technical sans-serif (Geist) is used for small caps, buttons, and data points to provide the "Industrial" precision.

## Layout & Spacing
The layout follows a **Rigid Industrial Grid**. 

- **Grid:** A 12-column grid for desktop with wide 24px gutters. Elements should feel "bolted" into place, often using vertical dividers to separate content zones.
- **Rhythm:** Spacing is generous. Large "stack" units (64px+) are used between major sections to emphasize the luxury of space.
- **Mobile:** Transition to a single-column layout with 20px side margins. High-density information should be contained within clear glass cards.

## Elevation & Depth
Depth is achieved through material simulation rather than generic shadows.

- **Glassmorphism:** Cards use a semi-transparent fill (`rgba(22, 42, 68, 0.6)`) with a high `backdrop-filter: blur(20px)`. 
- **Chrome Outlines:** Surfaces are defined by 1px solid borders using a linear gradient (Top-Left: #FFFFFF, Bottom-Right: #A8B2BD) at 30% opacity to mimic the glint of metal edges.
- **No Shadows:** Avoid traditional drop shadows. Use inner glows or "rim lighting" (top-edge strokes) to define elevation tiers.

## Shapes
The shape language is disciplined and architectural. 

- **Base Radius:** 4px (Soft) is the standard for cards and buttons, providing a hint of refinement without losing the "hard" industrial edge.
- **Strictness:** Avoid large pill shapes or circular elements unless they represent "stamps" or mechanical toggles. 
- **Interactive Elements:** Buttons and inputs maintain a sharp, precise look with minimal corner rounding.

## Components
- **Glass Cards:** Primary containers for referral stats and rewards. Must feature the frosted blur and the "Chrome Outline" described in the elevation section.
- **Chrome-Styled Buttons:** Solid #D4A574 (Bronze) for primary actions. Secondary buttons use a transparent background with a 1px metallic border and white text.
- **Status Badges:** Small, rectangular labels with Geist typography. Use "Industrial Orange" for pending and "Bronze" for confirmed referrals.
- **Progress Bars:** Thin, technical bars. The track is the background navy; the fill is a Bronze-to-Gold linear gradient. 
- **Referral Code Input:** A monospaced field that looks like a stamped serial number, using a high-contrast white border on focus.
- **Dividers:** 1px horizontal lines using the Chrome color at 20% opacity, often terminated with a small "plus" or "crosshair" icon at the ends to reinforce the architectural theme.