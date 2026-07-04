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
  secondary: '#c6c6c7'
  on-secondary: '#2f3132'
  secondary-container: '#454748'
  on-secondary-container: '#b5b5b6'
  tertiary: '#bbcae5'
  on-tertiary: '#223146'
  tertiary-container: '#a0afc9'
  on-tertiary-container: '#344258'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdcbc'
  primary-fixed-dim: '#efbd8a'
  on-primary-fixed: '#2c1700'
  on-primary-fixed-variant: '#614018'
  secondary-fixed: '#e3e2e3'
  secondary-fixed-dim: '#c6c6c7'
  on-secondary-fixed: '#1a1c1d'
  on-secondary-fixed-variant: '#454748'
  tertiary-fixed: '#d4e3ff'
  tertiary-fixed-dim: '#b8c7e2'
  on-tertiary-fixed: '#0c1c30'
  on-tertiary-fixed-variant: '#39475e'
  background: '#00142c'
  on-background: '#d4e3ff'
  surface-variant: '#223550'
typography:
  display-lg:
    fontFamily: EB Garamond
    fontSize: 64px
    fontWeight: '500'
    lineHeight: 72px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: EB Garamond
    fontSize: 40px
    fontWeight: '500'
    lineHeight: 48px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: EB Garamond
    fontSize: 32px
    fontWeight: '500'
    lineHeight: 40px
  headline-sm:
    fontFamily: EB Garamond
    fontSize: 24px
    fontWeight: '500'
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
  label-md:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.1em
  label-sm:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 20px
  margin-desktop: 64px
---

## Brand & Style

The design system embodies "Nocturnal Industrial Luxury," capturing the unique architectural essence of a high-end container cafe. The personality is sophisticated, moody, and structural, targeting an upscale demographic that appreciates avant-garde aesthetics and nighttime ambiance.

The visual style is a fusion of **Industrial Minimalism** and **Glassmorphism**. It utilizes deep, atmospheric surfaces to create a sense of infinite space, contrasted by hard, metallic edges and glowing warmth. The interface should feel like an architectural blueprint brought to life at twilight—precise, reflective, and inviting.

## Colors

The palette is anchored in the "Nocturnal" theme, utilizing high-contrast accents to guide the user's eye through the darkness.

- **Primary (Warm Bronze):** Used exclusively for high-priority calls to action, active states, and essential highlights. It represents the warm glow of interior lighting against the night.
- **Secondary (Chrome/Silver):** Applied to structural elements, borders, and secondary iconography. It provides the "Industrial" edge, often implemented with subtle linear gradients to mimic brushed metal.
- **Surface (Deep Navy):** The foundational canvas. It is a near-black navy that provides more depth and luxury than a pure neutral black.
- **Surface-Elevated (Midnight Blue):** Used for glassmorphic cards and containers to create separation from the background.

## Typography

The typography strategy relies on the tension between the classic and the technical.

- **Headlines:** We use a refined serif (EB Garamond as a high-quality alternative to Cormorant) for all large displays and headers. This evokes the "Luxury" aspect of the brand, appearing editorial and timeless.
- **Body & Interface:** Space Grotesk provides the "Industrial" counter-balance. Its geometric construction and technical quirks ensure legibility while maintaining a sleek, modern feel.
- **Styling Note:** Display headings should use tighter letter-spacing, while labels and small utility text should be tracked out slightly to enhance the architectural, blueprint-inspired aesthetic.

## Layout & Spacing

The layout is built on a **12-column fluid grid** for desktop and a **4-column grid** for mobile. The spacing rhythm is strictly mathematical, based on a 4px baseline to maintain industrial precision.

- **Margins:** Wide horizontal margins (64px+) on desktop create a gallery-like feel, allowing the high-end photography of the cafe to breathe.
- **Sectioning:** Vertical spacing between major sections should be generous (120px - 160px) to reinforce the premium, "unrushed" atmosphere.
- **Reflow:** On mobile devices, glassmorphic containers expand to edges, but retain internal padding of 24px to keep content from feeling cramped.

## Elevation & Depth

This design system eschews traditional drop shadows in favor of **Tonal Layering and Glassmorphism**.

- **Backdrop Blur:** All primary containers (cards, navigation bars, modals) must use a `12px` backdrop-filter blur.
- **Transparency:** Backgrounds of containers use the Deep Navy color at 60-80% opacity.
- **Chrome Strokes:** Instead of shadows, use 1px inner borders with a linear gradient (top-left to bottom-right) using the Chrome/Silver palette at low opacity (20-40%) to simulate light hitting a metallic edge.
- **Z-Axis:** Higher elevation is communicated through increased background brightness and sharper border definition, rather than shadow size.

## Shapes

The shape language is "Soft-Industrial." While the cafe is built from containers (traditionally sharp-edged), the digital experience adds a layer of luxury through subtle rounding.

- **Standard Elements:** Buttons and small inputs use a `4px` (Soft) radius to maintain a structural, crisp look.
- **Feature Cards:** Larger glassmorphic cards may use the `8px` (Large) radius to feel more approachable.
- **Interactive States:** Avoid fully rounded pills; maintain the rectangular silhouette to honor the industrial theme.

## Components

- **Buttons:** Primary buttons are solid Warm Bronze with black text (Space Grotesk Bold). Secondary buttons use a Chrome 1px border with a subtle hover "shimmer" effect.
- **Inputs:** Dark transparent backgrounds with 1px Chrome bottom-borders only, mimicking technical drafting styles.
- **Cards:** Glassmorphic backgrounds with the 12px blur. They should not have shadows; instead, they use a "rim light" effect—a thin, highlight-colored top border.
- **Chips/Labels:** Small, uppercase Space Grotesk text. These should look like stamped industrial metal tags or menu labels.
- **Lists:** Separated by thin (0.5px) Chrome lines with 10% opacity.
- **Navigation:** A persistent top bar with a heavy backdrop blur, ensuring the content beneath creates a shifting "nocturnal" texture as the user scrolls.