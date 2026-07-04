---
name: Kinetic Ledger
colors:
  surface: '#f8f9ff'
  surface-dim: '#ccdbf2'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eef4ff'
  surface-container: '#e5efff'
  surface-container-high: '#dbe9ff'
  surface-container-highest: '#d4e4fa'
  on-surface: '#0d1c2d'
  on-surface-variant: '#45474c'
  inverse-surface: '#233143'
  inverse-on-surface: '#e9f1ff'
  outline: '#75777d'
  outline-variant: '#c5c6cd'
  surface-tint: '#545f73'
  primary: '#091426'
  on-primary: '#ffffff'
  primary-container: '#1e293b'
  on-primary-container: '#8590a6'
  inverse-primary: '#bcc7de'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#111516'
  on-tertiary: '#ffffff'
  tertiary-container: '#26292b'
  on-tertiary-container: '#8d9092'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e3fb'
  primary-fixed-dim: '#bcc7de'
  on-primary-fixed: '#111c2d'
  on-primary-fixed-variant: '#3c475a'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#e0e3e5'
  tertiary-fixed-dim: '#c4c7c9'
  on-tertiary-fixed: '#191c1e'
  on-tertiary-fixed-variant: '#444749'
  background: '#f8f9ff'
  on-background: '#0d1c2d'
  surface-variant: '#d4e4fa'
typography:
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Hanken Grotesk
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 30px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  container-padding: 16px
  card-gutter: 12px
---

## Brand & Style

The design system is engineered for high-performance project management, prioritizing clarity, velocity, and professional reliability. It targets modern teams who require a tool that feels substantial yet unobtrusive. 

The aesthetic is **Corporate Modern with a Minimalist lean**. It leverages heavy whitespace to reduce cognitive load during complex task management, while utilizing card-based structures to provide tangible "objects" for users to interact with. The emotional response is one of organized calm—transforming chaotic workflows into structured, manageable progress.

## Colors

This design system utilizes a sophisticated palette of deep slates and cool grays to establish professional authority. 

- **Primary Slate (#1E293B):** Used for primary actions, navigation headers, and high-level project titles to ground the interface.
- **Secondary Cool Gray (#64748B):** Applied to supporting icons and secondary text to maintain hierarchy without competing for attention.
- **Surface Grays (#F8FAFC):** The primary background color to ensure the interface feels airy and modern.
- **Functional Accents:** Emerald Green and Amber are reserved strictly for semantic status signaling (Completion vs. In-Progress), ensuring that color always carries meaningful information.

## Typography

The design system employs **Hanken Grotesk** across all roles to achieve a sharp, technical, and contemporary feel. 

Hierarchy is established through aggressive weight switching rather than dramatic size shifts. Headlines utilize a bold weight with slight negative letter-spacing to appear compact and "locked-in." Labels for metadata (dates, tags, priority) use an uppercase style with increased tracking to ensure legibility at small sizes. Body text is kept clean with generous line heights to facilitate reading long task descriptions.

## Layout & Spacing

This design system follows a **4px baseline grid** and a fluid mobile layout. 

Content is primarily housed within a central container with **16px side margins**. Elements within the layout scale based on the device width, but maintain a strict rhythmic vertical spacing of 8px (sm), 16px (md), or 24px (lg). 

The card-based list view uses a **12px vertical gutter** between items to create a distinct visual separation that allows the subtle shadows of each card to breathe without overlapping.

## Elevation & Depth

Hierarchy is defined through **Ambient Shadows** and **Tonal Layering**. 

1. **Base Layer:** The background uses the Tertiary color (#F8FAFC), providing a clean canvas.
2. **Surface Layer:** Project cards and input fields are pure white (#FFFFFF). 
3. **Shadow Profile:** Cards utilize a soft, diffused shadow: `0px 4px 12px rgba(30, 41, 59, 0.05)`. This creates a subtle "lift" from the background, making the cards appear tactile and interactive.
4. **Active State:** When an element is pressed or dragged, the shadow deepens and expands slightly to `0px 8px 20px rgba(30, 41, 59, 0.1)`, providing immediate physical feedback.

## Shapes

The shape language is consistently **Rounded**, striking a balance between professional rigor and modern approachability. 

- **Standard Elements (Buttons, Inputs):** 0.5rem (8px) corner radius.
- **Container Elements (Cards, Modals):** 1rem (16px) corner radius.
- **Small Elements (Tags, Badges):** 0.25rem (4px) or fully rounded "pill" for status indicators.

This consistency ensures that the UI feels harmonious and deliberate.

## Components

### Buttons
- **Primary:** Deep Slate (#1E293B) background with white text. High-contrast and authoritative.
- **Secondary:** Ghost style with a 1px border of #CBD5E1.
- **Floating Action Button (FAB):** Primary Slate with a slightly stronger shadow to indicate its importance as the "New Task" trigger.

### Cards
Cards are the primary container. They feature a white background, 16px internal padding, and the standard 16px corner radius. Metadata (labels) should be aligned to the bottom left of the card.

### Status Indicators
Status indicators are small, pill-shaped chips. 
- **Completed:** Emerald Green background (10% opacity) with Emerald Green text.
- **In-Progress:** Amber background (10% opacity) with Amber text.

### Input Fields
Inputs use a 1px border (#E2E8F0) and a subtle 0.5rem radius. When focused, the border transitions to Primary Slate (#1E293B).

### Lists
Lists are implemented as a vertical stack of cards with 12px spacing. Avoid dividers between cards; the shadow and background color change provide sufficient separation.

### Progress Bars
Thin 4px horizontal tracks using #F1F5F9 as the background and the status-specific color (Emerald or Amber) for the fill.