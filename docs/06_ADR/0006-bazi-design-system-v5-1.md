# ADR 006: Adopt Bazi (Five Elements) Design System v5.1

**Date:** 2026-03-10  
**Status:** Accepted  
**Decision Maker:** Founder / UI Designer

## Context

We needed a visual identity that:
- Reflects Vietnamese cultural context (Sa Đéc, Mekong Delta)
- Aligns with founder's Feng Shui/Bazi philosophy
- Provides professional, premium aesthetic
- Has clear color tokens for consistency
- Supports dark/light modes

Alternatives:
1. **Bazi v5.1** (Navy + Chrome + Mộc colors, ban Fire/Earth)
2. **Material Design 3** (standard Google colors)
3. **Custom brand colors** (arbitrary selection)
4. **Tailwind UI** (pre-built component library)

## Decision

Chose **Bazi v5.1** color system:
- Primary (Thủy): Deep Navy `#0A1A2E`
- Secondary (Kim): Chrome Silver `#C9D6DF`
- Tertiary (Mộc): Forest Green `#1A2D1F`
- Banned: Fire (Red/Orange), Earth (Brown/Yellow)

## Consequences

### Positive
- ✅ **Cultural alignment**: Differentiates from generic SaaS aesthetics
- ✅ **Clear constraints**: "Banned colors" simplify design decisions
- ✅ **Premium feel**: Navy + silver is elegant, modern
- ✅ **Founder satisfaction**: Meets personal/brand requirements
- ✅ **Accessibility**: Navy/silver contrast meets WCAG AA

### Negative
- ⚠️ **Limited palette**: No warm colors (red/orange/yellow) — cannot use typical CTAs
  - Mitigation: Use Mộc green as accent for CTAs, or Chrome silver with bold typography
- ⚠️ **Designer learning curve**: Team must internalize Bazi principles
- ⚠️ **External libraries**: Need to map to MD3 token names (custom CSS)

### Risks
- **Color clash with 3rd party**: Embedded widgets (Google Maps, PayOS) may clash — use iframe containment
- **Brand evolution**: If founder's philosophy changes, major redesign needed
- **User testing**: No A/B testing of color alternatives (but brand comes first)

## Design Tokens (CSS Custom Properties)

```css
:root {
  --md-sys-color-primary: #0A1A2E;      /* Thủy — Navy */
  --md-sys-color-secondary: #C9D6DF;    /* Kim — Chrome */
  --md-sys-color-tertiary: #1A2D1F;     /* Mộc — Forest */
  --md-sys-color-surface: #0d1117;      /* Dark bg */
  --md-sys-color-on-surface: #e8eaed;   /* Text */
}
```

## Typography

- Headings: Cormorant Garamond (serif, elegant)
- Body: Space Grotesk (sans-serif, modern)
- Tech: JetBrains Mono (monospace for prices, code)

## Alternatives Considered (Rejected)

- **Standard MD3**: Too generic, doesn't reflect local culture
- **Tailwind CSS default colors**: Same issue — generic
- **Custom palette without Bazi**: Would not satisfy founder's vision

## Related

- Design tokens: `css/brand-tokens.css`
- Typography: `css/typography.css`
- Example usage: All HTML pages
- Founder manifesto: `docs/00_FOUNDER_MANIFESTO.md` (Bazi section)
