---
name: Nocturnal Industrial
colors:
  surface: '#00142a'
  surface-dim: '#00142a'
  surface-bright: '#273a53'
  surface-container-lowest: '#000f22'
  surface-container-low: '#061c34'
  surface-container: '#0b2038'
  surface-container-high: '#172b43'
  surface-container-highest: '#22364e'
  on-surface: '#d3e4ff'
  on-surface-variant: '#c5c6cd'
  inverse-surface: '#d3e4ff'
  inverse-on-surface: '#1e314a'
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
  background: '#00142a'
  on-background: '#d3e4ff'
  surface-variant: '#22364e'
typography:
  display-lg:
    fontFamily: EB Garamond
    fontSize: 48px
    fontWeight: '500'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: EB Garamond
    fontSize: 32px
    fontWeight: '500'
    lineHeight: '1.2'
  headline-md:
    fontFamily: EB Garamond
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
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
    lineHeight: '1.0'
    letterSpacing: 0.1em
  quote-text:
    fontFamily: EB Garamond
    fontSize: 22px
    fontWeight: '400'
    lineHeight: '1.5'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-margin: 24px
  gutter: 20px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
  section-gap: 64px
---

## Brand & Style
The design system embodies "Industrial Luxury," a narrative of precision, darkness, and high-end hospitality. It targets a discerning clientele that values the intersection of raw architectural elements and refined comfort. 

The aesthetic is rooted in **Glassmorphism** and **Modern Industrial** movements. It evokes a nocturnal atmosphere through the use of deep, expansive dark surfaces, punctuated by metallic "Chrome" accents and warm "Bronze" highlights. The emotional response is one of exclusive seclusion—a sanctuary that feels both structurally sound (industrial) and delicately layered (luxury).

## Colors
The palette is dominated by **Dark Navy (#0A1A2E)**, acting as the "midnight" canvas. This is not a flat black, but a deep, pressurized blue that provides more depth for glass effects.

- **Primary (Dark Navy):** Foundations, backgrounds, and deep structural layers.
- **Secondary (Chrome):** Used for technical data, iconography, and subtle borders to mimic brushed metal.
- **Tertiary (Bronze):** Reserved for high-value interactions, ratings (stars), and call-to-action highlights to provide warmth against the cool industrial base.
- **Glass Surfaces:** Semi-transparent variations of the neutral blue, allowing background blurs to create a sense of physical thickness and luxury.

## Typography
The typography strategy creates a tension between heritage and future. 

**EB Garamond** (as a high-quality alternative to Cormorant) provides the "Luxury" component—used for guest names, editorial pull-quotes, and section headings. It should be typeset with generous leading to feel airy and prestigious.

**Space Grotesk** provides the "Industrial" component. Its tabular-leaning proportions and geometric terminals make it ideal for technical review data (dates, rating numbers) and the primary body of the review text. Use the `label-caps` style for metadata to reinforce the precision-engineered feel.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy on desktop (max-width 1200px) to maintain a controlled, gallery-like experience. 

- **Desktop:** 12-column grid with wide 32px gutters to allow the glass elements "room to breathe."
- **Mobile:** Single column with 24px side margins.
- **Rhythm:** Spacing is strictly mathematical, based on a 4px baseline. Use larger vertical gaps (`section-gap`) to separate distinct review entries, creating a sense of individual "exhibits."

## Elevation & Depth
Depth is achieved through **Glassmorphism** rather than traditional drop shadows. 

1.  **Base Layer:** Solid Dark Navy (#0A1A2E).
2.  **Mid Layer (Cards):** Translucent Navy (60% opacity) with a 20px backdrop blur. 
3.  **Accent Layer (Overlays):** 1px internal "Chrome" stroke at 20% opacity on the top and left edges to simulate light hitting a glass edge.
4.  **Interactive State:** When a card is hovered, the backdrop blur increases and the "Bronze" accent appears as a subtle outer glow (0px 0px 15px rgba(212, 165, 116, 0.15)).

## Shapes
In accordance with the "Round Eight" requirement, the standard corner radius is **12px**.

- **Cards & Containers:** 12px (`rounded-md`).
- **Interactive Elements (Buttons):** 12px to match the structural language.
- **Large Sections:** Up to 24px (`rounded-xl`) for main content wrappers.
- **Media (Images):** Always clipped to 12px to maintain the cohesive industrial silhouette.

## Components

- **Review Cards:** Utilize the glassmorphic style with a 1px Chrome border. The reviewer’s name is in EB Garamond, while the review body is in Space Grotesk.
- **Star Ratings:** Rendered in solid Bronze (#D4A574). Use sharp, geometric star icons to align with the industrial theme.
- **Buttons:** Primary buttons use a Bronze background with Dark Navy text. Secondary buttons are ghost-style with a Chrome border and Space Grotesk caps.
- **Input Fields:** Darker than the base layer, with a 1px Chrome bottom-border only, mimicking a technical blueprint or form.
- **Chips/Tags:** Small, pill-shaped (using max-roundedness) with a Dark Navy fill and Chrome text, used for "Verified Visit" or "Must Try" labels.
- **Images/Gallery:** Review photos should have a slight desaturation filter applied to blend with the nocturnal aesthetic, revealing full color only on hover.