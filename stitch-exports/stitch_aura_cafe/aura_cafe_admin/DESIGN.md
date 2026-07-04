---
name: Aura Cafe Admin
colors:
  surface: '#131315'
  surface-dim: '#131315'
  surface-bright: '#39393b'
  surface-container-lowest: '#0e0e10'
  surface-container-low: '#1b1b1d'
  surface-container: '#1f1f21'
  surface-container-high: '#292a2c'
  surface-container-highest: '#343536'
  on-surface: '#e4e2e4'
  on-surface-variant: '#c5c6cd'
  inverse-surface: '#e4e2e4'
  inverse-on-surface: '#303032'
  outline: '#8e9097'
  outline-variant: '#44474d'
  surface-tint: '#b8c7e2'
  primary: '#b8c7e2'
  on-primary: '#223146'
  primary-container: '#0a1a2e'
  on-primary-container: '#74839c'
  inverse-primary: '#505f76'
  secondary: '#c2c6d2'
  on-secondary: '#2b313a'
  secondary-container: '#424751'
  on-secondary-container: '#b0b5c1'
  tertiary: '#e5c099'
  on-tertiary: '#432c10'
  tertiary-container: '#281500'
  on-tertiary-container: '#9c7c5a'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d4e3ff'
  primary-fixed-dim: '#b8c7e2'
  on-primary-fixed: '#0c1c30'
  on-primary-fixed-variant: '#39475e'
  secondary-fixed: '#dee2ef'
  secondary-fixed-dim: '#c2c6d2'
  on-secondary-fixed: '#161c24'
  on-secondary-fixed-variant: '#424751'
  tertiary-fixed: '#ffddba'
  tertiary-fixed-dim: '#e5c099'
  on-tertiary-fixed: '#2b1701'
  on-tertiary-fixed-variant: '#5c4224'
  background: '#131315'
  on-background: '#e4e2e4'
  surface-variant: '#343536'
typography:
  display-logo:
    fontFamily: Cormorant Garamond
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '500'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Space Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.0'
    letterSpacing: 0.1em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  2xl: 64px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style
The brand personality is defined by "Industrial Luxury"—a blend of raw, technical precision and high-end hospitality. It evokes the atmosphere of a premium night lounge: exclusive, dark, and sophisticated. The UI should feel like a high-end physical interface found in a modern architectural space.

The style is **Glassmorphism** meets **High-Contrast Industrial**. It utilizes deep, atmospheric backgrounds contrasted against sharp, metallic "Chrome" accents. Surfaces are ethereal and translucent, while structural elements (borders and dividers) are rigid and polished. The emotional response is one of calm authority and sleek professionalism.

## Colors
The palette is dominated by the **Dark Navy (#0A1A2E)** foundation, which acts as the canvas for the entire experience. 

- **Primary Background:** Used for the lowest level of the application.
- **Chrome Accents:** A metallic gradient applied to primary actions, active states, and thin structural borders. It provides a tactile, "etched" feel.
- **Glass Surfaces:** Semi-transparent layers (`white/5`) with heavy background blurring to create depth without losing the dark, moody essence of the base color.
- **Functional Colors:** Success (Emerald), Warning (Amber), and Error (Crimson) should be desaturated to maintain the premium aesthetic, used only for critical feedback.

## Typography
The typography strategy creates a tension between classical elegance and technical precision.

- **Logo & Branding:** Use **Cormorant Garamond** for the brand mark and high-level editorial headers. This introduces the "Luxury" aspect of the brand.
- **Interface & Data:** Use **Space Grotesk** for all functional UI elements. Its geometric, slightly futuristic construction reinforces the "Industrial" theme.
- **Hierarchy:** Use all-caps with generous letter spacing for labels and categories to mimic technical schematics or high-end architectural signage.

## Layout & Spacing
The layout follows a **Fixed Grid** model for admin dashboards to ensure data density remains readable.

- **Desktop:** 12-column grid with a fixed sidebar (280px). Content is centered in a container with a max-width of 1440px.
- **Spacing Rhythm:** Based on a 4px scale. Use `lg` (24px) for padding within glass cards and `xl` (40px) for section vertical spacing.
- **Negative Space:** Maintain significant outer margins on desktop to allow the dark navy background to "frame" the glass interface, enhancing the lounge atmosphere.

## Elevation & Depth
Depth is achieved through physical layering and optical properties rather than traditional shadows.

1.  **Level 0 (Base):** Solid #0A1A2E.
2.  **Level 1 (Panels):** White/5 background, `backdrop-blur: 24px`. Thin `0.5px` border in #FFFFFF/10.
3.  **Level 2 (Modals/Popovers):** White/10 background, `backdrop-blur: 40px`. Thin `1px` Chrome gradient border.
4.  **Accents:** Use the Chrome gradient as a "stroke" for active elements to make them appear etched into the dark surface. Shadows, when used, should be extremely subtle, large-radius, and dark blue (#000000) to simulate ambient occlusion in a dimly lit room.

## Shapes
Shapes are disciplined and architectural. 

- **Primary Radius:** `4px` (Soft) is the standard for most containers and buttons to maintain a sharp, professional edge.
- **Large Radius:** Use `8px` or `12px` only for large layout containers or "Glass" cards.
- **Interactive Elements:** Checkboxes and radio buttons remain sharp or only slightly softened (2px) to align with the industrial aesthetic. Avoid large pill shapes unless used for specialized status "pills."

## Components
- **Buttons:** 
    - *Primary:* Chrome gradient fill with Dark Navy text. Sharp corners (4px).
    - *Secondary:* Transparent with a 1px Chrome gradient border.
- **Cards:** White/5 background with 20px backdrop blur. Borders are 0.5px solid white/15.
- **Inputs:** Darker than the background (#050D17) with a bottom-only Chrome border that glows slightly on focus.
- **Chips/Status:** Small, all-caps Space Grotesk text. Use low-opacity tinted backgrounds (e.g., Green at 10% opacity) with a solid 2px vertical "status bar" on the left edge.
- **Sidebar:** Full height, semi-transparent. Active links use a thin Chrome vertical bar on the left and a subtle white/5 highlight.
- **Navigation:** Use minimal icons (thin stroke, 1px) paired with the `label-caps` typography style.