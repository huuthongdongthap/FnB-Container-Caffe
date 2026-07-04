---
name: Nocturnal Industrial Luxury
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
    fontFamily: Libre Caslon Text
    fontSize: 64px
    fontWeight: '400'
    lineHeight: 72px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Libre Caslon Text
    fontSize: 40px
    fontWeight: '400'
    lineHeight: 48px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Libre Caslon Text
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 40px
  headline-sm:
    fontFamily: Libre Caslon Text
    fontSize: 24px
    fontWeight: '400'
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
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.1em
  label-md:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
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
  margin-desktop: 64px
  margin-mobile: 20px
---

## Brand & Style
The design system embodies "Nocturnal Industrial Luxury," a high-end aesthetic tailored for a premium night lounge and café experience. The target audience is sophisticated, urban, and tech-savvy individuals seeking an atmospheric, exclusive environment.

The UI leverages a blend of **Glassmorphism** and **Modern Industrialism**. It utilizes deep, atmospheric layering to create a sense of physical depth, mimicking the interior of a dimly lit lounge with polished metal accents. The emotional response is one of calm, focused mystery and uncompromising quality. High contrast between the dark foundation and metallic typography ensures a "glowing" effect that feels both futuristic and timeless.

## Colors
The palette is rooted in a nocturnal foundation to maintain a "dark mode" exclusivity.

- **Primary (Night Navy):** #0A1A2E. Used for the base canvas and deep structural backgrounds.
- **Secondary (Chrome Silver):** #C6C6C7. Used for high-contrast technical details, icons, and primary labels.
- **Tertiary (Warm Bronze):** #D4A574. Used sparingly for interactive highlights, premium calls to action, and focus states.
- **Surface (Steel Layer):** #162A44. A slightly lighter navy used for cards and elevation before applying glass effects.
- **Overlay (Glass):** White at 5-10% opacity with high backdrop blur to simulate frosted partitions.

## Typography
The typographic strategy pits the classical elegance of **Libre Caslon Text** (serving as a high-fidelity alternative to Cormorant Garamond) against the technical precision of **Space Grotesk**.

- **Serif Headings:** Large display sizes should use tight letter-spacing. Use these for storytelling, menu categories, and editorial sections.
- **Sans-Serif Body:** Space Grotesk provides an industrial, legible contrast. Use this for all functional information, pricing, and descriptions.
- **Micro-copy:** Use uppercase labels with generous tracking (0.1em) for navigation and category tags to emphasize the "technical luxury" vibe.

## Layout & Spacing
The layout follows a **fluid grid** with strict geometric alignment. 

- **Desktop:** 12-column grid with wide outer margins (64px) to create an airy, gallery-like feel.
- **Mobile:** 4-column grid with reduced margins (20px).
- **Rhythm:** An 8px linear scale is used for all internal padding and margins. Vertical rhythm is generous; use white space (or "dark space") to separate distinct sections of the experience, avoiding crowded clusters.

## Elevation & Depth
Depth is created through **Glassmorphism** rather than traditional drop shadows.

- **Base Layer:** Solid Night Navy (#0A1A2E).
- **Mid Layer:** Frosted Glass panels. Apply `backdrop-filter: blur(20px)` and a thin 1px border using a gradient from White (15% opacity) to White (5% opacity).
- **High Layer:** Elements that require focus (like Modals or Active Buttons) use a faint Bronze (#D4A574) glow—an outer shadow with a large blur (30px) and very low opacity (10%).
- **Accents:** Use 1px "Chrome" lines (Secondary Color at 30% opacity) to divide content sections, mimicking architectural metal beams.

## Shapes
The shape language is **Soft** but controlled. 

Corners are slightly rounded (4px to 12px) to prevent the UI from feeling too aggressive, while maintaining the structured integrity of industrial design. Interactive containers (Buttons, Inputs) use the `0.25rem` base, while large glass sections and cards use `0.75rem` (rounded-xl) to feel like polished, heavy glass slabs.

## Components
- **Buttons:** Primary buttons are Chrome Silver with black text for maximum impact. Secondary buttons are "Ghost" style with a 1px Bronze border and Bronze text.
- **Cards:** Use the frosted glass effect. Background: White (5% opacity). Border: 1px Silver (10% opacity). Blur: 16px.
- **Inputs:** Darker than the background (#050D17) with a bottom-only 1px Chrome Silver border. On focus, the border transitions to Bronze.
- **Chips/Labels:** Small, all-caps Space Grotesk text inside a Dark Navy pill with a 1px Silver stroke.
- **Lists:** Menu items should be separated by thin, 1px horizontal lines (Silver, 10% opacity). Pricing should always be in Space Grotesk for a modern, precise feel.
- **Navigation:** A fixed top bar with high backdrop-blur, creating a "lens" effect over the content as the user scrolls.