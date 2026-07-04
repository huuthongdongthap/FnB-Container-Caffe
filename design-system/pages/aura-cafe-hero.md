# AURA CAFE — Hero Landing Page

> **Source:** `stitch-exports/stitch_aura_cafe/aura_cafe_luxury_landing_hero/code.html`
> **OVERWRITES** `MASTER.md` for hero-specific tokens.

---

## Tailwind Config (extracted)

### Colors

```json
"background": "#00142c",
"surface": "#00142c",
"surface-dim": "#00142c",
"surface-bright": "#273a55",
"surface-container": "#0b203a",
"surface-container-low": "#061c35",
"surface-container-lowest": "#000e23",
"surface-container-high": "#172b45",
"surface-container-highest": "#223550",
"surface-variant": "#223550",
"on-surface": "#d4e3ff",
"on-surface-variant": "#c5c6cd",
"primary": "#b8c7e2",
"on-primary": "#223146",
"primary-container": "#0a1a2e",
"on-primary-container": "#74839c",
"primary-fixed": "#d4e3ff",
"primary-fixed-dim": "#b8c7e2",
"on-primary-fixed": "#0c1c30",
"on-primary-fixed-variant": "#39475e",
"secondary": "#c6c6c7",
"on-secondary": "#2f3132",
"secondary-container": "#454748",
"on-secondary-container": "#b5b5b6",
"secondary-fixed": "#e3e2e3",
"secondary-fixed-dim": "#c6c6c7",
"on-secondary-fixed": "#1a1c1d",
"on-secondary-fixed-variant": "#454748",
"tertiary": "#efbd8a",
"on-tertiary": "#472a03",
"tertiary-container": "#291500",
"on-tertiary-container": "#a47a4d",
"tertiary-fixed": "#ffdcbc",
"tertiary-fixed-dim": "#efbd8a",
"on-tertiary-fixed": "#2c1700",
"on-tertiary-fixed-variant": "#614018",
"error": "#ffb4ab",
"on-error": "#690005",
"error-container": "#93000a",
"on-error-container": "#ffdad6",
"outline": "#8e9097",
"outline-variant": "#44474d",
"inverse-surface": "#d4e3ff",
"inverse-on-surface": "#1e314b",
"inverse-primary": "#505f76",
"surface-tint": "#b8c7e2"
```

### Typography

| Name | Font | Size | Line-Height | Weight | Letter-Spacing |
|------|------|------|-------------|--------|---------------|
| display-lg | Libre Caslon Text | 64px | 72px | 400 | -0.02em |
| display-lg-mobile | Libre Caslon Text | 40px | 48px | 400 | -0.01em |
| headline-md | Libre Caslon Text | 32px | 40px | 400 | — |
| headline-sm | Libre Caslon Text | 24px | 32px | 400 | — |
| body-lg | Space Grotesk | 18px | 28px | 400 | — |
| body-md | Space Grotesk | 16px | 24px | 400 | — |
| label-md | Space Grotesk | 14px | 20px | 500 | — |
| label-caps | Space Grotesk | 12px | 16px | 600 | 0.1em |

### Border Radius

| Token | Value |
|-------|-------|
| DEFAULT | 0.125rem (2px) |
| lg | 0.25rem (4px) |
| xl | 0.5rem (8px) |
| full | 0.75rem (12px) |

### Spacing

| Token | Value |
|-------|-------|
| unit | 8px |
| gutter | 24px |
| margin-desktop | 64px |
| margin-mobile | 20px |
| container-max | 1200px |

### Glassmorphism

```css
.glass-panel {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(198, 198, 199, 0.15);
}
```

### Shadow

```css
/* bronze glow on hover */
.bronze-glow:hover {
  box-shadow: 0 0 30px rgba(212, 165, 116, 0.2);
}
/* nav bar shadow */
.shadow-nav {
  box-shadow: 0 0 30px rgba(212, 165, 116, 0.1);
}
```

### Gradient Effects

```css
.nocturnal-gradient {
  background: radial-gradient(circle at top right, rgba(184, 199, 226, 0.05), transparent 60%),
              radial-gradient(circle at bottom left, rgba(212, 165, 116, 0.03), transparent 50%);
}
.chrome-line {
  background: linear-gradient(90deg, transparent, rgba(198, 198, 199, 0.3), transparent);
  height: 1px;
}
```

---

## Design Notes

- **Mood:** Sophisticated, warm, nocturnal — premium rooftop lounge
- **Display font** is Libre Caslon Text (italic serif)
- **Tertiary (#efbd8a)** is the warm bronze accent — used for CTAs, highlights, decorative borders
- **Secondary (#c6c6c7)** is the chrome/silver metallic accent
- Buttons use `border-radius: 0.5rem (xl)` — slightly rounded, not pill
- Navigation uses 20px blur glass with bronze shadow
- Cards lift 8px on hover with smooth 500ms transition
