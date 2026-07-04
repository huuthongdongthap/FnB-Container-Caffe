---
name: Nocturnal Industrial
colors:
  surface: '#121416'
  surface-dim: '#121416'
  surface-bright: '#37393b'
  surface-container-lowest: '#0c0e10'
  surface-container-low: '#1a1c1e'
  surface-container: '#1e2022'
  surface-container-high: '#282a2c'
  surface-container-highest: '#333537'
  on-surface: '#e2e2e5'
  on-surface-variant: '#c5c6cd'
  inverse-surface: '#e2e2e5'
  inverse-on-surface: '#2f3133'
  outline: '#8e9097'
  outline-variant: '#44474d'
  surface-tint: '#b8c7e2'
  primary: '#b8c7e2'
  on-primary: '#223146'
  primary-container: '#0a1a2e'
  on-primary-container: '#74839c'
  inverse-primary: '#505f76'
  secondary: '#c5c6ca'
  on-secondary: '#2e3034'
  secondary-container: '#47494d'
  on-secondary-container: '#b7b8bc'
  tertiary: '#e7c090'
  on-tertiary: '#432c08'
  tertiary-container: '#271600'
  on-tertiary-container: '#9e7c52'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d4e3ff'
  primary-fixed-dim: '#b8c7e2'
  on-primary-fixed: '#0c1c30'
  on-primary-fixed-variant: '#39475e'
  secondary-fixed: '#e2e2e6'
  secondary-fixed-dim: '#c5c6ca'
  on-secondary-fixed: '#1a1c1f'
  on-secondary-fixed-variant: '#45474a'
  tertiary-fixed: '#ffddb6'
  tertiary-fixed-dim: '#e7c090'
  on-tertiary-fixed: '#2a1800'
  on-tertiary-fixed-variant: '#5d421c'
  background: '#121416'
  on-background: '#e2e2e5'
  surface-variant: '#333537'
typography:
  display-lg:
    fontFamily: Libre Caslon Text
    fontSize: 56px
    fontWeight: '400'
    lineHeight: 64px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Libre Caslon Text
    fontSize: 40px
    fontWeight: '400'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Libre Caslon Text
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 40px
  title-lg:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: 0.05em
  body-md:
    fontFamily: Space Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.1em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
---

## Brand & Style
The design system embodies an "Industrial Luxury" aesthetic, blending the raw, engineered precision of container architecture with the refined atmosphere of a high-end nocturnal lounge. The brand personality is calm, sophisticated, and meticulously crafted.

The visual style leverages **Glassmorphism** as its primary structural metaphor. UI elements appear as frosted glass panes suspended in a dark, atmospheric void. This is accented by metallic textures—specifically **Chrome** for precision and **Muted Bronze** for warmth—creating a sense of "Engineered Elegance." The emotional response is one of exclusive, quiet confidence and technical mastery.

## Colors
The palette is rooted in the "Nocturnal" theme, utilizing deep shadows and metallic highlights to define form.

- **Primary (Deep Navy - #0A1A2E):** The foundation of the UI, representing the night sky and deep steel.
- **Secondary (Chrome Silver - #A8A9AD):** Used for interactive elements, iconography, and precision borders.
- **Tertiary (Muted Bronze - #96754B):** Reserved for high-end accents, call-to-actions, and premium status indicators.
- **Neutral (Charcoal - #1A1C1E):** Used for surface backing and structural elements where transparency isn't required.

The color system relies on high-contrast metallic accents against low-value backgrounds to guide the eye through the "industrial" space.

## Typography
The typographic system creates a tension between the classical and the industrial. 

**Libre Caslon Text** (serving as the substitute for the requested high-contrast serif) is used for headlines to evoke luxury and heritage. It should be typeset with generous leading and slight negative tracking for a tighter, more editorial feel.

**Space Grotesk** handles all functional and body text. Its geometric, monospaced-leaning construction reinforces the "engineered" aesthetic. Labels should frequently use uppercase with wide letter-spacing to mimic industrial stamping and technical specifications.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy inspired by modular container architecture. Content is housed within rigid, structural blocks.

- **Grid:** A 12-column grid on desktop with substantial 64px outer margins to create a sense of focused, premium space.
- **Rhythm:** An 8px linear scale governs all padding and margins. 
- **Modular Sections:** Large sections are separated by "structural gaps" (e.g., 80px or 120px) to simulate the separation between architectural modules.
- **Mobile:** Reflows to a single column with 16px margins, maintaining the "glass block" stack.

## Elevation & Depth
Depth is not achieved through traditional shadows, but through **Tonal Layering** and **Backdrop Effects**.

- **Glassmorphism:** Primary containers use a semi-transparent fill of `#FFFFFF` at 5-10% opacity with a `20px` backdrop-blur. 
- **Chrome Outlines:** Instead of shadows, use 1px solid borders using the Chrome (#A8A9AD) palette at 20-30% opacity to define the "glass" edges.
- **Internal Glow:** High-elevation elements (like active cards) receive a subtle inner-glow (stroke) of Bronze (#96754B) to suggest light catching a metallic edge.
- **Z-Index:** Layers are strictly hierarchical—base background, then glass containers, then floating interactive elements.

## Shapes
The shape language is "Soft-Industrial." While the grid is rigid and architectural, individual elements use a **Soft** radius to ensure the UI feels modern and tactile rather than sharp and hostile.

- **Base Radius:** 0.25rem (4px) for small components like inputs and tags.
- **Container Radius:** 0.75rem (12px) for large glass cards and modular containers.
- **Interactive Elements:** Buttons maintain a consistent 4px radius to echo the "machined" look of industrial hardware.

## Components
- **Buttons:** Primary buttons use a solid Bronze (#96754B) background with Black text. Secondary buttons use a Chrome (#A8A9AD) 1px border with no fill and White text.
- **Glass Cards:** The signature component. Semi-transparent (#FFFFFF @ 0.05) with 20px blur and a subtle 1px Chrome top-border.
- **Inputs:** Darker than the background (#050D17), sharp corners (4px), with a Chrome bottom-border that glows Bronze on focus.
- **Chips/Tags:** Minimalist, using Space Grotesk Bold. They should look like technical labels or engraved serial numbers.
- **Progress Indicators:** Use thin, 2px Chrome lines with a Bronze "active" state, reminiscent of precision measuring tools.
- **Lists:** Separated by thin 1px horizontal lines at 10% opacity, utilizing high-contrast typography for item titles.