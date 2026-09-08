# M3 Token Mapping -- AURA CAFE

> Bridge layer between Material Design 3 semantic tokens (`md-sys-*`) and AURA brand tokens. Source: `src/styles/brand-tokens.css` (v6.0+)

## Principles

- `md-sys-*` tokens are **aliases** to `aura-*` -- they do not replace. Both systems coexist.
- New components use `md-sys-*` (M3 compliance); legacy components keep `aura-*`.
- Tailwind v4 `@theme` maps `--color-md-*` to classes `bg-md-*`, `text-md-*`, `border-md-*`.

## TypeScript Usage

```ts
import { m3Tokens } from '@/theme/m3-tokens';

// Inline styles
const style = { background: m3Tokens.color.surface, borderRadius: m3Tokens.shape.medium };

// Duration + easing
const transition = `${m3Tokens.motion.durationMedium2} ${m3Tokens.motion.easingStandard}`;
```

## CSS Usage

```css
.card {
  background: var(--md-sys-color-surface);
  border-radius: var(--md-sys-shape-corner-medium);
  box-shadow: var(--md-sys-elevation-1);
  transition: box-shadow 300ms cubic-bezier(0.2, 0, 0, 1);
}
```

## Tailwind v4 Usage

```
bg-md-surface-container text-md-on-surface rounded-[var(--md-sys-shape-corner-medium)]
```

---

## Color Role Mapping (34 tokens)

### Surface

| M3 Token | Aura Token | Aura Value | TW Class |
|----------|-----------|------------|----------|
| `--md-sys-color-surface` | `--aura-noir-deep` | `#0A1A2E` | `bg-md-surface` |
| `--md-sys-color-surface-dim` | `--aura-noir-void` | `#050D1A` | `bg-md-surface-dim` |
| `--md-sys-color-surface-bright` | `--aura-noir-bright` | `#25406B` | `bg-md-surface-bright` |
| `--md-sys-color-surface-container-lowest` | `--aura-noir-void` | `#050D1A` | `bg-md-surface-container-lowest` |
| `--md-sys-color-surface-container-low` | `--aura-noir-deep` | `#0A1A2E` | `bg-md-surface-container-low` |
| `--md-sys-color-surface-container` | `--aura-noir-mid` | `#1A2A4E` | `bg-md-surface-container` |
| `--md-sys-color-surface-container-high` | `--aura-noir-bright` | `#25406B` | `bg-md-surface-container-high` |
| `--md-sys-color-surface-container-highest` | `--aura-noir-steel` | `#334155` | `bg-md-surface-container-highest` |
| `--md-sys-color-on-surface` | `--aura-text-primary` | `#F5F5F5` | `text-md-on-surface` |
| `--md-sys-color-on-surface-variant` | `--aura-text-muted` | `#8A8E96` | `text-md-on-surface-variant` |

### Primary (Forest / Mộc)

| M3 Token | Aura Token | Aura Value | TW Class |
|----------|-----------|------------|----------|
| `--md-sys-color-primary` | `--aura-forest-light` | `#4A7C59` | `bg-md-primary` |
| `--md-sys-color-on-primary` | `--aura-noir-deep` | `#0A1A2E` | `text-md-on-primary` |
| `--md-sys-color-primary-container` | `--aura-forest-deep` | `#1A2D1F` | `bg-md-primary-container` |
| `--md-sys-color-on-primary-container` | `--aura-forest-pale` | `#A8C5A0` | `text-md-on-primary-container` |

### Secondary (Chrome / Kim)

| M3 Token | Aura Token | Aura Value | TW Class |
|----------|-----------|------------|----------|
| `--md-sys-color-secondary` | `--aura-chrome-light` | `#C9D6DF` | `bg-md-secondary` |
| `--md-sys-color-on-secondary` | `--aura-noir-deep` | `#0A1A2E` | `text-md-on-secondary` |
| `--md-sys-color-secondary-container` | `--aura-chrome-dark` | `#3A6B80` | `bg-md-secondary-container` |
| `--md-sys-color-on-secondary-container` | `--aura-chrome-bright` | `#E8EEF3` | `text-md-on-secondary-container` |

### Tertiary

| M3 Token | Aura Token | Aura Value | TW Class |
|----------|-----------|------------|----------|
| `--md-sys-color-tertiary` | `--aura-chrome-mid` | `#6B9FB8` | `bg-md-tertiary` |
| `--md-sys-color-on-tertiary` | `--aura-noir-deep` | `#0A1A2E` | `text-md-on-tertiary` |
| `--md-sys-color-tertiary-container` | `--aura-chrome-dark` | `#3A6B80` | `bg-md-tertiary-container` |
| `--md-sys-color-on-tertiary-container` | `--aura-chrome-bright` | `#E8EEF3` | `text-md-on-tertiary-container` |

### Inverse

| M3 Token | Aura Token | Aura Value | TW Class |
|----------|-----------|------------|----------|
| `--md-sys-color-inverse-surface` | `--aura-text-primary` | `#F5F5F5` | `bg-md-inverse-surface` |
| `--md-sys-color-inverse-on-surface` | `--aura-noir-deep` | `#0A1A2E` | `text-md-inverse-on-surface` |
| `--md-sys-color-inverse-primary` | `--aura-forest-primary` | `#2D5A3D` | `text-md-inverse-primary` |

### Outline

| M3 Token | Aura Token | Aura Value | TW Class |
|----------|-----------|------------|----------|
| `--md-sys-color-outline` | `--aura-chrome-mid` | `#6B9FB8` | `border-md-outline` |
| `--md-sys-color-outline-variant` | `--aura-border-chrome` | `rgba(201,214,223,0.25)` | `border-md-outline-variant` |

### Error

| M3 Token | Aura Token | Aura Value | TW Class |
|----------|-----------|------------|----------|
| `--md-sys-color-error` | `--aura-error` | `#ffb4ab` | `bg-md-error` |
| `--md-sys-color-on-error` | `--aura-noir-deep` | `#0A1A2E` | `text-md-on-error` |
| `--md-sys-color-error-container` | `--aura-danger` (darkened) | `#93000a` | `bg-md-error-container` |
| `--md-sys-color-on-error-container` | -- | `#ffdad6` | `text-md-on-error-container` |

### Utility

| M3 Token | Aura Token | Aura Value | TW Class |
|----------|-----------|------------|----------|
| `--md-sys-color-scrim` | -- | `rgba(0,0,0,0.6)` | `bg-md-scrim` |
| `--md-sys-color-shadow` | -- | `rgba(0,0,0,0.3)` | -- |

---

## Shape Token Mapping (7 tokens)

| M3 Token | Aura Token | Aura Value | TW Class |
|----------|-----------|------------|----------|
| `--md-sys-shape-corner-none` | -- | `0px` | `rounded-[var(--md-sys-shape-corner-none)]` |
| `--md-sys-shape-corner-extra-small` | -- | `4px` | `rounded-[var(--md-sys-shape-corner-extra-small)]` |
| `--md-sys-shape-corner-small` | `--aura-radius-sm` | `4px` | `rounded-[var(--md-sys-shape-corner-small)]` |
| `--md-sys-shape-corner-medium` | `--aura-radius-md` | `8px` | `rounded-[var(--md-sys-shape-corner-medium)]` |
| `--md-sys-shape-corner-large` | `--aura-radius-lg` | `16px` | `rounded-[var(--md-sys-shape-corner-large)]` |
| `--md-sys-shape-corner-extra-large` | `--aura-radius-xl` | `24px` | `rounded-[var(--md-sys-shape-corner-extra-large)]` |
| `--md-sys-shape-corner-full` | `--aura-radius-pill` | `50px` | `rounded-[var(--md-sys-shape-corner-full)]` |

---

## Elevation Token Mapping (5 tokens)

| M3 Token | Aura Token | Aura Value | TW Class |
|----------|-----------|------------|----------|
| `--md-sys-elevation-0` | -- | `none` | `shadow-none` |
| `--md-sys-elevation-1` | `--aura-shadow-sm` | `0 2px 8px rgba(0,0,0,0.2)` | `shadow-md` |
| `--md-sys-elevation-2` | `--aura-shadow-md` | `0 8px 30px rgba(0,0,0,0.18)` | `shadow-lg` |
| `--md-sys-elevation-3` | `--aura-shadow-lg` | `0 16px 60px rgba(0,0,0,0.45)` | `shadow-xl` |
| `--md-sys-elevation-4` | -- | `0 6px 10px 4px rgba(0,0,0,0.18)` | -- |

CSS classes `.elevation-1` through `.elevation-5` are also available via `brand-tokens.css`.

---

## Motion Token Mapping (14 tokens)

### Duration

| M3 Token | Aura Token | Value |
|----------|-----------|-------|
| `durationShort1` | -- | `50ms` |
| `durationShort2` | -- | `100ms` |
| `durationShort3` | `--aura-duration-fast` | `150ms` |
| `durationShort4` | -- | `200ms` |
| `durationMedium1` | -- | `250ms` |
| `durationMedium2` | `--aura-duration-base` | `300ms` |
| `durationMedium3` | -- | `350ms` |
| `durationMedium4` | -- | `400ms` |
| `durationLong1` | -- | `450ms` |
| `durationLong2` | `--aura-duration-slow` | `500ms` |

### Easing

| M3 Token | Aura Token | Value |
|----------|-----------|-------|
| `easingStandard` | `--aura-ease` | `cubic-bezier(0.2, 0, 0, 1)` |
| `easingEmphasized` | `--aura-ease` | `cubic-bezier(0.2, 0, 0, 1)` |
| `easingEmphasizedDecelerate` | `--aura-ease-out` | `cubic-bezier(0.05, 0.7, 0.1, 1)` |
| `easingEmphasizedAccelerate` | `--aura-ease-in` | `cubic-bezier(0.3, 0, 0.8, 0.15)` |

---

## Migration Guide

### For new components

Use M3 tokens exclusively:

```tsx
import { m3Tokens } from '@/theme/m3-tokens';

function NewCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: m3Tokens.color.surfaceContainer,
        color: m3Tokens.color.onSurface,
        borderRadius: m3Tokens.shape.medium,
        padding: '16px',
      }}
    >
      {children}
    </div>
  );
}
```

### For existing components

Keep `aura-*` tokens. Do not mass-migrate. When touching a component for other reasons, optionally switch to `md-sys-*` tokens.

### CSS custom property layer

The `md-sys-*` CSS custom properties must be defined in `:root` or a theme scope (e.g. via Tailwind v4 `@theme`). Example:

```css
:root {
  --md-sys-color-surface: var(--aura-noir-deep);
  --md-sys-color-on-surface: var(--aura-text-primary);
  /* ... remaining mappings ... */
}
```

This layer should be added in `src/styles/brand-tokens.css` or a dedicated `src/styles/m3-bridge.css`.
