# Phase 1 — M3 Design Token Layer

**Priority:** P0 · **Status:** Pending · **Depends:** None

## Overview

Thêm toàn bộ M3 semantic token layer vào `brand-tokens.css` (alias sang aura values hiện tại) + update `global.css` Tailwind v4 @theme mapping. Kết quả: bất kỳ component nào cũng có thể dùng `bg-md-sys-color-surface-container` hoặc `text-md-sys-color-on-surface` song song với `bg-aura-noir-void`.

## Related Files

- Modify: `src/styles/brand-tokens.css` (thêm ~80 M3 semantic tokens)
- Modify: `src/styles/global.css` (thêm @theme mapping cho md-sys → TW)
- Create: `src/theme/m3-tokens.ts` (TypeScript interface + constants cho M3 layer)
- Modify: `src/theme/index.ts` (export m3Tokens)
- Create: `docs/m3-token-mapping.md` (bảng mapping aura ↔ md-sys, phục vụ audit)

## Implementation Steps

### 1.1 M3 Color Tokens (~40 tokens)

Thêm vào `:root {}` trong `brand-tokens.css`:

```css
/* ═══════════ M3 SEMANTIC LAYER ═══════════ */
/* Surface */
--md-sys-color-surface:              var(--aura-noir-deep);
--md-sys-color-surface-dim:          var(--aura-noir-void);
--md-sys-color-surface-bright:       var(--aura-noir-mid);
--md-sys-color-surface-container-lowest: var(--aura-noir-void);
--md-sys-color-surface-container-low:   var(--aura-noir-deep);
--md-sys-color-surface-container:       var(--aura-noir-mid);
--md-sys-color-surface-container-high:  var(--aura-noir-bright);
--md-sys-color-surface-container-highest: var(--aura-noir-steel);
/* On-surface */
--md-sys-color-on-surface:           var(--aura-text-primary);
--md-sys-color-on-surface-variant:   var(--aura-text-body);
/* Primary */
--md-sys-color-primary:              var(--aura-forest-light);
--md-sys-color-on-primary:           var(--aura-text-primary);
--md-sys-color-primary-container:    var(--aura-forest-deep);
--md-sys-color-on-primary-container: var(--aura-forest-pale);
/* Secondary */
--md-sys-color-secondary:            var(--aura-chrome-light);
--md-sys-color-on-secondary:         var(--aura-noir-deep);
--md-sys-color-secondary-container:  var(--aura-chrome-dark);
--md-sys-color-on-secondary-container: var(--aura-chrome-bright);
/* Tertiary */
--md-sys-color-tertiary:             var(--aura-forest-pale);
--md-sys-color-on-tertiary:          var(--aura-noir-deep);
--md-sys-color-tertiary-container:   var(--aura-forest-deep);
--md-sys-color-on-tertiary-container: var(--aura-forest-light);
/* Error */
--md-sys-color-error:                #DC2626;
--md-sys-color-on-error:             #FFFFFF;
--md-sys-color-error-container:      rgba(220, 38, 38, 0.12);
--md-sys-color-on-error-container:   #FCA5A5;
/* Outline */
--md-sys-color-outline:              var(--aura-chrome-dark);
--md-sys-color-outline-variant:      var(--aura-border-chrome);
/* Inverse */
--md-sys-color-inverse-surface:      var(--aura-chrome-bright);
--md-sys-color-inverse-on-surface:   var(--aura-noir-deep);
--md-sys-color-inverse-primary:      var(--aura-forest-primary);
/* Scrim / Shadow */
--md-sys-color-scrim:                rgba(0, 0, 0, 0.32);
--md-sys-color-shadow:               rgba(0, 0, 0, 0.25);
```

### 1.2 M3 Typography Tokens (~12 tokens)

```css
/* Typescale — M3 spec (Google Fonts) */
--md-sys-typescale-display-large:    700 57px/64px var(--aura-font-display);
--md-sys-typescale-display-medium:   600 45px/52px var(--aura-font-display);
--md-sys-typescale-display-small:    600 36px/44px var(--aura-font-display);
--md-sys-typescale-headline-large:   600 32px/40px var(--aura-font-display);
--md-sys-typescale-headline-medium:  500 28px/36px var(--aura-font-display);
--md-sys-typescale-headline-small:   500 24px/32px var(--aura-font-display);
--md-sys-typescale-title-large:      500 22px/28px var(--aura-font-body);
--md-sys-typescale-title-medium:     500 16px/24px var(--aura-font-body);
--md-sys-typescale-title-small:      500 14px/20px var(--aura-font-body);
--md-sys-typescale-body-large:       400 16px/24px var(--aura-font-body);
--md-sys-typescale-body-medium:      400 14px/20px var(--aura-font-body);
--md-sys-typescale-body-small:       400 12px/16px var(--aura-font-body);
--md-sys-typescale-label-large:      500 14px/20px var(--aura-font-body);
--md-sys-typescale-label-medium:     500 12px/16px var(--aura-font-body);
--md-sys-typescale-label-small:      500 11px/16px var(--aura-font-body);
```

### 1.3 M3 Shape Tokens (~6 tokens)

```css
--md-sys-shape-corner-none:          0px;
--md-sys-shape-corner-extra-small:   4px;
--md-sys-shape-corner-small:         8px;
--md-sys-shape-corner-medium:        12px;
--md-sys-shape-corner-large:         16px;
--md-sys-shape-corner-extra-large:   28px;
--md-sys-shape-corner-full:          9999px;
```

### 1.4 M3 Elevation Tokens (~5 tokens)

```css
--md-sys-elevation-0:  none;
--md-sys-elevation-1:  0 1px 2px rgba(0,0,0,0.3), 0 1px 3px 1px rgba(0,0,0,0.15);
--md-sys-elevation-2:  0 1px 2px rgba(0,0,0,0.3), 0 2px 6px 2px rgba(0,0,0,0.15);
--md-sys-elevation-3:  0 4px 8px 3px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.3);
--md-sys-elevation-4:  0 6px 10px 4px rgba(0,0,0,0.15), 0 2px 3px rgba(0,0,0,0.3);
--md-sys-elevation-5:  0 8px 12px 6px rgba(0,0,0,0.15), 0 4px 4px rgba(0,0,0,0.3);
```

### 1.5 M3 Motion Tokens (~8 tokens)

```css
--md-sys-motion-easing-standard:          cubic-bezier(0.2, 0, 0, 1);
--md-sys-motion-easing-standard-decelerate: cubic-bezier(0, 0, 0, 1);
--md-sys-motion-easing-standard-accelerate: cubic-bezier(0.3, 0, 1, 1);
--md-sys-motion-easing-emphasized:         cubic-bezier(0.2, 0, 0, 1);
--md-sys-motion-easing-emphasized-decelerate: cubic-bezier(0.05, 0.7, 0.1, 1);
--md-sys-motion-easing-emphasized-accelerate: cubic-bezier(0.3, 0, 0.8, 0.15);
--md-sys-motion-duration-short1:   50ms;
--md-sys-motion-duration-short2:   100ms;
--md-sys-motion-duration-short3:   150ms;
--md-sys-motion-duration-short4:   200ms;
--md-sys-motion-duration-medium1:  250ms;
--md-sys-motion-duration-medium2:  300ms;
--md-sys-motion-duration-medium3:  350ms;
--md-sys-motion-duration-medium4:  400ms;
--md-sys-motion-duration-long1:    450ms;
--md-sys-motion-duration-long2:    500ms;
```

### 1.6 Tailwind v4 @theme Update

```css
@theme {
  /* existing aura mappings... */

  /* M3 Surface */
  --color-md-surface:                var(--md-sys-color-surface);
  --color-md-surface-dim:            var(--md-sys-color-surface-dim);
  --color-md-surface-container:      var(--md-sys-color-surface-container);
  --color-md-surface-container-high: var(--md-sys-color-surface-container-high);
  --color-md-on-surface:             var(--md-sys-color-on-surface);
  --color-md-on-surface-variant:     var(--md-sys-color-on-surface-variant);
  /* M3 Primary */
  --color-md-primary:                var(--md-sys-color-primary);
  --color-md-on-primary:             var(--md-sys-color-on-primary);
  --color-md-primary-container:      var(--md-sys-color-primary-container);
  --color-md-on-primary-container:   var(--md-sys-color-on-primary-container);
  /* M3 Secondary */
  --color-md-secondary:              var(--md-sys-color-secondary);
  --color-md-on-secondary:           var(--md-sys-color-on-secondary);
  --color-md-secondary-container:    var(--md-sys-color-secondary-container);
  /* M3 Tertiary */
  --color-md-tertiary:               var(--md-sys-color-tertiary);
  --color-md-on-tertiary:            var(--md-sys-color-on-tertiary);
  --color-md-tertiary-container:     var(--md-sys-color-tertiary-container);
  /* M3 Error */
  --color-md-error:                  var(--md-sys-color-error);
  --color-md-on-error:               var(--md-sys-color-on-error);
  --color-md-error-container:        var(--md-sys-color-error-container);
  /* M3 Outline */
  --color-md-outline:                var(--md-sys-color-outline);
  --color-md-outline-variant:        var(--md-sys-color-outline-variant);
  /* M3 Shape */
  --radius-md-xs:    var(--md-sys-shape-corner-extra-small);
  --radius-md-sm:    var(--md-sys-shape-corner-small);
  --radius-md-md:    var(--md-sys-shape-corner-medium);
  --radius-md-lg:    var(--md-sys-shape-corner-large);
  --radius-md-xl:    var(--md-sys-shape-corner-extra-large);
  --radius-md-full:  var(--md-sys-shape-corner-full);
}
```

### 1.7 TypeScript Layer

Tạo `src/theme/m3-tokens.ts`:
- `M3ColorTokens` interface (40 keys)
- `M3TypescaleTokens` interface (15 keys)
- `M3ShapeTokens` interface (7 keys)
- `M3ElevationTokens` interface (6 keys)
- `M3MotionTokens` interface (16 keys)
- Helper `resolveM3Token(name: string)` → CSS var reference

## Success Criteria

- [ ] 80+ M3 tokens defined in `brand-tokens.css`
- [ ] `@theme` maps M3 → Tailwind (usable: `bg-md-surface-container`)
- [ ] TypeScript exports compile (no TS errors)
- [ ] `docs/m3-token-mapping.md` mapping table exists
- [ ] Existing components vẫn render identical (visual regression)
- [ ] Build green, tests green

## Risk Assessment

- **Low risk:** Tokens là alias, không thay thế aura. Zero breaking changes.
- **Potential:** Tailwind v4 @theme có limit ~100 custom properties — monitor nếu exceed

## Next Steps

Phase 2: Component primitives sử dụng tokens mới.
