---
name: Nocturnal Industrial Luxury
colors:
  surface: '#081425'
  surface-dim: '#081425'
  surface-bright: '#2f3a4c'
  surface-container-lowest: '#040e1f'
  surface-container-low: '#111c2d'
  surface-container: '#152031'
  surface-container-high: '#1f2a3c'
  surface-container-highest: '#2a3548'
  on-surface: '#d8e3fb'
  on-surface-variant: '#c5c6cd'
  inverse-surface: '#d8e3fb'
  inverse-on-surface: '#263143'
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
  background: '#081425'
  on-background: '#d8e3fb'
  surface-variant: '#2a3548'
typography:
  display-lg:
    fontFamily: Libre Caslon Text
    fontSize: 64px
    fontWeight: '400'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Libre Caslon Text
    fontSize: 40px
    fontWeight: '400'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Libre Caslon Text
    fontSize: 32px
    fontWeight: '400'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
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
    letterSpacing: 0.15em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  container-max: 1280px
  gutter: 24px
  margin-mobile: 20px
  stack-sm: 8px
  stack-md: 24px
  stack-lg: 48px
---

## Brand & Style
The design system embodies "Nocturnal Industrial Luxury," a high-end aesthetic tailored for elite evening events and exclusive lounge promotions. The brand personality is enigmatic, sophisticated, and raw, blending the cold precision of industrial materials with the warmth of high-end hospitality. 

The visual style utilizes a refined **Glassmorphism** approach. Interfaces should feel like layered obsidian and smoked glass, punctuated by metallic accents. High contrast is essential; while the environment is dark, typography and key interactive elements must cut through the atmosphere with crystalline clarity. The emotional goal is to make the user feel like they are entering a private, members-only digital space.

## Colors
The palette is anchored in deep shadows and metallic highlights.
- **Primary (Deep Night):** `#0A1A2E` serves as the canvas, providing a vast, dark navy void.
- **Accent (Bronze):** `#D4A574` is used for high-value calls to action, premium indicators, and ornate typographic flourishes.
- **Secondary Accent (Chrome):** `#E5E7EB` (Silver/Chrome) provides the industrial edge, used for borders, icons, and secondary details.
- **Neutral (Slate Glass):** `#1E293B` is used for surface containers that require slight elevation from the primary background.

All text on the primary background should utilize high-contrast whites or the Bronze accent to ensure legibility in a "nocturnal" setting.

## Typography
The typography system relies on the tension between the classical elegance of **Libre Caslon Text** (serving as a high-quality alternative to Cormorant Garamond for digital stability) and the technical, futuristic vibe of **Space Grotesk**.

- **Headlines:** Use serif fonts for all event titles and section headers. Ensure generous line-height to maintain a "luxury editorial" feel.
- **Body & Technical Info:** Use Space Grotesk for all functional text, descriptions, and metadata. The monolinear strokes provide an industrial, machined contrast to the serif headings.
- **Labels:** Use uppercase Space Grotesk with wide letter spacing for tags, dates, and category labels to evoke a "stamped" or "industrial" look.

## Layout & Spacing
The layout follows a **fluid grid** model with significant vertical "breathing room" to maintain an air of exclusivity. 

- **Desktop:** 12-column grid with 24px gutters. Content should be centered with wide margins to create a focused, cinematic experience.
- **Mobile:** 4-column grid with 20px side margins. 
- **Vertical Rhythm:** Use a strict 8px base unit. Larger components like event cards should be separated by `stack-lg` (48px) to prevent the dark UI from feeling cluttered. Use asymmetrical layouts (e.g., 5-column content next to 7-column imagery) to reinforce the sophisticated, non-corporate aesthetic.

## Elevation & Depth
Depth is achieved through **Glassmorphism** and light-source simulation rather than traditional shadows.

1.  **Base:** The `#0A1A2E` background.
2.  **Middleground:** Semi-transparent containers (10-20% opacity) with a `backdrop-filter: blur(12px)`.
3.  **Foreground:** Interactive elements featuring a subtle "Chrome" inner-stroke (0.5px border at 30% opacity) to catch the "light."
4.  **Accents:** Bronze elements should appear as if they are back-lit or glowing slightly, using a soft outer glow (`box-shadow`) in the Bronze hex at low opacity to simulate a neon or warm metallic reflection.

## Shapes
To maintain the "Industrial Luxury" theme, shapes are kept **Soft (0.25rem - 0.75rem)**. Avoid fully rounded pill shapes as they appear too playful. The slight rounding mimics high-end industrial design—machined edges that are precise but not sharp.

- **Primary Buttons:** Soft corners (4px).
- **Event Cards:** Medium rounding (12px) to soften the glass edges.
- **Media Containers:** Sharp or 4px corners to keep a cinematic look.

## Components
- **Buttons:** Primary buttons use a solid Bronze background with high-contrast dark text. Secondary buttons use a "Chrome" ghost style (thin silver border, no fill) with a hover effect that increases background blur opacity.
- **Event Cards:** Large-scale glass containers. Use a subtle gradient stroke (Chrome to Transparent) to define the edge. The background image of the event should have a dark overlay to ensure white serif typography is legible.
- **Lists:** Event schedules should use monospaced-style labels from Space Grotesk. Use thin Chrome dividers (0.5px) between items.
- **Chips/Tags:** Use the "Label Caps" typography style. Tags should have a dark navy fill and a 1px Bronze border to denote "Premium" or "VIP" status.
- **Inputs:** Dark, translucent backgrounds with a bottom-only border in Chrome. When focused, the border transitions to Bronze.
- **Navigation:** A floating glass bar at the top or bottom, utilizing high backdrop-blur to maintain readability as the user scrolls through vibrant event photography.