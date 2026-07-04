---
name: Nocturnal Industrial Luxury
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c5c6cd'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
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
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  headline-xl:
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
  headline-lg-mobile:
    fontFamily: EB Garamond
    fontSize: 28px
    fontWeight: '500'
    lineHeight: '1.2'
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
  label-md:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: 0.1em
  label-sm:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  container-padding: 40px
  gutter: 24px
  section-gap: 64px
  inner-padding: 16px
---

## Brand & Style
The design system embodies "Nocturnal Industrial Luxury," targeting a high-end clientele who value the atmosphere of a sophisticated evening lounge. The aesthetic balances the raw, structural honesty of industrial design with the ethereal, high-tech elegance of modern luxury.

The style is primarily **Glassmorphism**, utilized to create a sense of depth and exclusivity. Interfaces should feel like looking through smoked glass or dark obsidian, with layers of information floating atop one another. The emotional response is one of calm, focused indulgence—like a quiet corner in a premium members-only club.

## Colors
The palette is rooted in the deep shadows of the night.
- **Primary (#0A1A2E):** A Dark Navy used for the base environment and deep background layers. It provides the "nocturnal" canvas.
- **Secondary (#C6C6C7):** A "Chrome" accent used for technical details, borders, and secondary text, echoing brushed steel and industrial precision.
- **Tertiary (#D4A574):** A "Bronze" accent used sparingly for primary actions and highlights, suggesting warmth, craftsmanship, and premium quality.
- **Neutral:** Pure blacks and deep grays are used to anchor the glass surfaces and ensure legibility.

## Typography
The typography strategy contrasts classical elegance with technical modernity. 
- **Headlines:** Utilize **EB Garamond** (as the closest high-quality alternative to Cormorant) to convey history, luxury, and an editorial feel.
- **Body & Technical Info:** **Space Grotesk** provides an industrial, geometric counterpoint. Its wide apertures and technical look make checkout data, prices, and labels feel precise and modern.
- **Styling:** Use uppercase for labels with increased letter spacing to enhance the premium, curated feel of the industrial aesthetic.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy for desktop to maintain a cinematic, centered focus, while transitioning to a fluid layout for mobile. 

- **Desktop:** A centered 12-column grid with generous outer margins to evoke a sense of space and exclusivity.
- **Spacing Rhythm:** Based on an 8px scale. Use large gaps (64px+) between major sections to prevent the UI from feeling crowded.
- **Mobile:** Transition to a 4-column grid with 20px side margins. Elements should be stacked vertically to maintain legibility of the delicate Glassmorphism effects.

## Elevation & Depth
Depth is achieved through **Glassmorphism** and subtle **Tonal Layers**. 
- **Surfaces:** Use a semi-transparent Dark Navy (#0A1A2E at 70-80% opacity) with a background blur (Backdrop Filter: blur(12px-20px)).
- **Borders:** Instead of heavy shadows, use thin (1px) inner borders in Chrome (#C6C6C7) at low opacity (15-20%) to simulate the edge of a glass pane.
- **Shadows:** Use extremely soft, large-radius ambient shadows with a slight primary tint to lift active components without creating "muddy" dark spots.

## Shapes
The shape language is "Soft" yet disciplined. While the industrial influence suggests harsh edges, the luxury aspect demands comfort. 
- **Corners:** Use subtle rounding (0.25rem for small elements, 0.75rem for cards) to mimic the precision-machined edges of industrial glass and metal.
- **Interactive Elements:** Buttons and input fields should maintain consistent small-radius corners to feel structural and firm. Avoid pill shapes; stick to refined rectangles with soft corners.

## Components
- **Buttons:** Primary buttons use the Bronze (#D4A574) background with dark text. Secondary buttons are "Ghost" style with a Chrome (#C6C6C7) border and blurred background.
- **Input Fields:** Semi-transparent dark backgrounds with a bottom-only border in Chrome, creating a sleek, architectural look.
- **Cards:** These are the primary glass elements. They must feature the 1px inner stroke and a high-intensity background blur to separate content from the deep navy background.
- **Chips/Status:** Use Space Grotesk in a small, bold, all-caps format. Industrial status indicators should use "lit" versions of the accent colors (e.g., a small glowing Bronze dot).
- **Checkout Summary:** A tall, vertical glass panel that stays anchored, providing a constant view of the "total" in a large EB Garamond typeface.