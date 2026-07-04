---
name: Industrial Luxury Noir
colors:
  surface: '#051424'
  surface-dim: '#051424'
  surface-bright: '#2c3a4c'
  surface-container-lowest: '#010f1f'
  surface-container-low: '#0d1c2d'
  surface-container: '#122131'
  surface-container-high: '#1c2b3c'
  surface-container-highest: '#273647'
  on-surface: '#d4e4fa'
  on-surface-variant: '#c5c6cd'
  inverse-surface: '#d4e4fa'
  inverse-on-surface: '#233143'
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
  tertiary: '#adc8f5'
  on-tertiary: '#133155'
  tertiary-container: '#001a38'
  on-tertiary-container: '#6984ad'
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
  tertiary-fixed: '#d5e3ff'
  tertiary-fixed-dim: '#adc8f5'
  on-tertiary-fixed: '#001c3b'
  on-tertiary-fixed-variant: '#2d486d'
  background: '#051424'
  on-background: '#d4e4fa'
  surface-variant: '#273647'
typography:
  display-lg:
    fontFamily: Syne
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Syne
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Syne
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
  timer-display:
    fontFamily: Space Grotesk
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: -0.05em
  body-lg:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '500'
    lineHeight: '1.5'
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
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 24px
  margin: 32px
  ticket-width: 320px
  stack-gap: 16px
---

## Brand & Style

This design system is engineered for high-stakes, elite culinary environments. It balances the raw, utilitarian nature of a professional kitchen with the refined elegance of luxury hospitality. The brand personality is **composed, authoritative, and surgical**, designed to reduce cognitive load while maintaining an aesthetic of high-end precision.

The visual style is a fusion of **Glassmorphism** and **Industrial Minimalism**. By using deep, nocturnal foundations layered with translucent surfaces and metallic accents, the UI recedes into the background of a dimly lit kitchen while allowing critical data—timers, modifiers, and order status—to gleam with clarity. Every interaction is designed to feel tactile and intentional, mirroring the physical touchpoints of premium kitchen hardware.

## Colors

The palette is rooted in **Deep Midnight Navy**, providing a low-glare canvas that minimizes eye strain in dark environments. **Bronze** serves as the primary functional accent, representing the "Preparing" state and the core brand identity.

- **Foundational Navy:** Used for the base environment and deep-layered surfaces.
- **Bronze Accent:** Reserved for active states, high-priority buttons, and "In-Progress" indicators.
- **Status Indicators:** A high-contrast triad of Amber (Pending), Bronze (Preparing), and Emerald (Ready). These colors are applied with high saturation to ensure they are legible from across a steaming, busy kitchen line.
- **Chrome/Metallic:** Used for borders and decorative strokes to evoke professional stainless steel and brass equipment.

## Typography

Typography in this design system prioritizes technical legibility and hierarchy. 

**Syne** is utilized for high-contrast headlines and order numbers, providing an avant-garde, industrial character that feels modern and exclusive. 

**Space Grotesk** is the workhorse for all data-heavy elements. Its geometric construction ensures that "8s" and "Bs" or "0s" and "Os" are never confused—a critical requirement for accurate order fulfillment. 

For timers, a specialized **timer-display** style is used with tight letter-spacing to ensure the countdown remains the focal point of the ticket. All labels follow a strict uppercase convention to denote secondary metadata like table numbers or guest names.

## Layout & Spacing

The layout follows a **Fixed Column Grid** optimized for a "Ticket Rail" experience. Content is organized into vertical columns that represent the flow of the kitchen line.

- **Grid:** A 12-column layout is used for dashboard views, while the primary KDS interface uses a horizontal scrolling rail of 320px wide columns.
- **Rhythm:** A 4px base unit governs all spacing. Gutters between tickets are set at 24px to prevent visual bleed between distinct orders.
- **Density:** High-density spacing is permitted within the ticket cards to maximize information visibility, but external margins remain generous (32px) to frame the UI within the hardware bezel.
- **Responsiveness:** On mobile/tablet "Expo" views, columns collapse into a single-feed list with increased vertical padding for touch-friendly interaction.

## Elevation & Depth

This design system uses **Tonal Glassmorphism** to create a sense of organized layers. Depth is not communicated through traditional shadows, but through backdrop filters and luminosity.

- **Level 0 (Base):** Deep Midnight Navy background.
- **Level 1 (Tickets):** Semi-transparent (60% opacity) navy surfaces with a `20px` backdrop blur. This allows the subtle glow of status colors to permeate the background.
- **Chrome Accents:** 1px solid borders with a linear gradient (from white at 20% opacity to navy at 10% opacity) simulate a beveled metal edge.
- **Active State:** When a ticket or item is selected, it gains a subtle inner glow in Bronze, signaling focus without disrupting the dark aesthetic.

## Shapes

The shape language is **Soft Industrial**. While the core of the design is precise and grid-aligned, edges are softened with a `0.25rem` (4px) radius to prevent the UI from feeling hostile. 

- **Cards/Tickets:** Use `rounded-lg` (8px) to create a distinct container against the dark void.
- **Action Buttons:** Use `rounded-xl` (12px) to differentiate interactive elements from static information containers.
- **Status Pills:** Utilize full-round (pill) shapes to denote tags like "Gluten Free" or "VIP," ensuring they stand out against the rectangular ticket structure.

## Components

### Tickets (Orders)
The primary component. It features a glass-morphic background, a top-aligned status bar (colored by status), and a chrome-bordered footer containing the action button. Headers within tickets use Syne for the order ID.

### Tactile 'Complete' Button
These buttons are the most physical elements in the UI. They utilize a multi-stop chrome gradient (Silver to Steel) with high-contrast Bronze text. On press, they exhibit an "inset" shadow effect to mimic a physical mechanical switch.

### High-Contrast Timers
Located in the top-right of every ticket. Timers should pulse slowly in Red if the order exceeds the target preparation time, utilizing a glow effect rather than a solid color change to maintain the noir atmosphere.

### Chips & Modifiers
Modifiers (e.g., "No Onions") are displayed as high-contrast inverted chips—light text on a dark Navy background with a sharp 1px Bronze border to ensure the chef never misses a critical instruction.

### Global Status Bar
A thin, persistent bar at the top of the screen that shows "Station Load" using a gradient scale from Navy to Bronze, keeping the head chef informed of kitchen capacity at a glance.