# AURA CAFE — Container Landing Page

> **Source:** `stitch-exports/stitch_aura_cafe/aura_cafe_luxury_container_landing/code.html`
> **OVERWRITES** `MASTER.md` for container-landing-specific tokens.

---

## Tailwind Config (extracted)

### Colors

```json
"background": "#081425",
"surface": "#081425",
"surface-dim": "#081425",
"surface-bright": "#2f3a4c",
"surface-container": "#152031",
"surface-container-low": "#111c2d",
"surface-container-lowest": "#040e1f",
"surface-container-high": "#1f2a3c",
"surface-container-highest": "#2a3548",
"surface-variant": "#2a3548",
"on-surface": "#d8e3fb",
"on-surface-variant": "#c5c6cd",
"primary": "#b8c7e2",
"on-primary": "#223146",
"primary-container": "#0a1a2e",
"on-primary-container": "#74839c",
"primary-fixed": "#d4e3ff",
"primary-fixed-dim": "#b8c7e2",
"on-primary-fixed": "#0c1c30",
"on-primary-fixed-variant": "#39475e",
"secondary": "#efbd8a",
"on-secondary": "#472a03",
"secondary-container": "#64421a",
"on-secondary-container": "#dfaf7e",
"secondary-fixed": "#ffdcbc",
"secondary-fixed-dim": "#efbd8a",
"on-secondary-fixed": "#2c1700",
"on-secondary-fixed-variant": "#614018",
"tertiary": "#c1c7cf",
"on-tertiary": "#2b3137",
"tertiary-container": "#141a20",
"on-tertiary-container": "#7c838a",
"tertiary-fixed": "#dde3eb",
"tertiary-fixed-dim": "#c1c7cf",
"on-tertiary-fixed": "#161c22",
"on-tertiary-fixed-variant": "#41474e",
"error": "#ffb4ab",
"on-error": "#690005",
"error-container": "#93000a",
"on-error-container": "#ffdad6",
"outline": "#8e9097",
"outline-variant": "#44474d",
"inverse-surface": "#d8e3fb",
"inverse-on-surface": "#263143",
"inverse-primary": "#505f76",
"surface-tint": "#b8c7e2"
```

> **Note:** Role swap vs Hero page — here `secondary` = bronze (#efbd8a), `tertiary` = silver-gray (#c1c7cf). Hero page reverses this. The Material 3 dynamic color system generates different role mappings per screen.

### Typography

| Name | Font | Size | Line-Height | Weight | Letter-Spacing |
|------|------|------|-------------|--------|---------------|
| headline-xl | EB Garamond | 64px | 1.1 | 500 | -0.02em |
| headline-lg | EB Garamond | 48px | 1.2 | 500 | -0.01em |
| headline-lg-mobile | EB Garamond | 36px | 1.2 | 500 | — |
| headline-md | EB Garamond | 32px | 1.3 | 500 | — |
| headline-sm | EB Garamond | 24px | 1.4 | 600 | — |
| body-lg | Space Grotesk | 18px | 1.6 | 400 | — |
| body-md | Space Grotesk | 16px | 1.6 | 400 | — |
| body-sm | Space Grotesk | 14px | 1.5 | 400 | — |
| label-caps | Space Grotesk | 12px | 1.0 | 600 | 0.1em |

### Border Radius

| Token | Value |
|-------|-------|
| DEFAULT | 0.25rem (4px) |
| lg | 0.5rem (8px) |
| xl | 0.75rem (12px) |
| full | 9999px |

### Spacing

| Token | Value |
|-------|-------|
| unit | 8px |
| gutter | 24px |
| margin-desktop | 64px |
| margin-mobile | 20px |
| container-max | 1280px |

### Glassmorphism

```css
.glass-panel {
  background: rgba(148, 163, 184, 0.1);
  backdrop-filter: blur(12px);
  border: 1px solid transparent;
  border-image: linear-gradient(135deg, #94A3B8 0%, rgba(148, 163, 184, 0) 100%) 1;
}
```

### Shadow

```css
.bronze-glow {
  box-shadow: 0 0 20px rgba(212, 165, 116, 0.15);
}
.bronze-glow-hover:hover {
  box-shadow: 0 0 30px rgba(212, 165, 116, 0.35);
}
```

### Gradient Effects

```css
.metallic-gradient {
  background: linear-gradient(135deg, #D4A574 0%, #B48554 100%);
}
.container-ribs {
  background-image: linear-gradient(90deg, rgba(30, 41, 59, 0.5) 1px, transparent 1px);
  background-size: 80px 100%;
}
```

### Blur Decorative Circles

```css
/* Large ambient glow circles */
.glow-orange {
  background: rgba(239, 189, 138, 0.1); /* secondary/bronze */
  filter: blur(120px);
}
.glow-blue {
  background: rgba(184, 199, 226, 0.1); /* primary/blue */
  filter: blur(120px);
}
```

---

## Design Notes

- **Mood:** Industrial luxury with warmth — bilingual (Vietnamese/English)
- **Display font** is EB Garamond (serif, heavier weight 500-600)
- **Secondary (#efbd8a)** is the warm bronze accent (CTAs, highlights) — note role swap vs hero page
- **Background (#081425)** is slightly lighter than hero (#00142c)
- **Container max-width** is 1280px (wider than hero's 1200px)
- Buttons are **square** (no border-radius) with metallic gradient or outline
- Glass panel uses **gradient border** (not solid) for a more refined edge
- Decorative container-ribs pattern mimics shipping container corrugation
