# Phase 2 — M3 Component Primitives

**Priority:** P0 · **Status:** ✅ Done · **Depends:** Phase 1 (tokens)

## Overview

Tạo 12 M3 component primitives tại `src/components/md3/` — Tailwind-based, dùng M3 tokens từ Phase 1, theo đúng M3 spec (variant, state layers, touch targets). Không thêm dependency — pure React 19 + Tailwind v4.

## Related Files

- Create: `src/components/md3/` (12 components + index.ts)
- Create: `src/components/md3/__tests__/` (unit tests)
- Create: `docs/m3-component-usage.md` (API reference)

## Component Specs

### 2.1 MD3Button

```tsx
// Variants: filled | outlined | text | elevated | tonal
// Sizes: default (40px height) | compact
// States: hover (state layer 8%), focus-visible (ring), active (12%), disabled (opacity 0.38)
// Touch target: ≥48px hit area (py extension)
<MD3Button variant="filled" onClick={...}>Label</MD3Button>
```
M3 spec: label `label-large`, shape `corner-full`, icon tùy chọn leading.

### 2.2 MD3Card

```tsx
// Variants: elevated | filled | outlined
// 12px corner, surface-container-low default, elevation-1 elevated
<MD3Card variant="elevated" onClick={...}>children</MD3Card>
```

### 2.3 MD3Fab

```tsx
// Variants: primary | secondary | tertiary | surface
// Sizes: small | medium | large
// Shape: corner-large (16px), corner-extra-large for large
<MD3Fab icon={<Plus />} aria-label="Add" onClick={...} />
```

### 2.4 MD3Chip

```tsx
// Variants: assist | filter | input | suggestion
// States: selected (checkmark leading), elevated option
<MD3Chip variant="filter" selected={bool}>Label</MD3Chip>
```

### 2.5 MD3NavigationBar + MD3NavigationBarItem

```tsx
// Max 5 items (M3 hard rule), icon + label required
// Height 80px, item 64px width
// Active: pill indicator on icon (secondary-container bg)
<MD3NavigationBar value={tab} onChange={setTab}>
  <MD3NavigationBarItem icon={<Home />} label="Home" value="home" />
</MD3NavigationBar>
```

### 2.6 MD3TopAppBar

```tsx
// Variants: small | center-aligned | medium | large
// Height: 64px small, 152px medium, 200px large
// Scroll: color transitions surface → surface-container (on-scroll)
<MD3TopAppBar title="Menu" leadingIcon={<Menu />} actions={[...]} />
```

### 2.7 MD3TextField

```tsx
// Variants: filled | outlined
// States: error, supporting text, character counter, trailing icon
// Floating label pattern (label moves up on focus)
<MD3TextField label="Email" type="email" error={msg} supportingText="..." />
```

### 2.8 MD3Switch

```tsx
// M3 spec: no thumb movement on track, thumb scales 16→28px, icons optional
<MD3Switch checked={bool} onChange={...} />
```

### 2.9 MD3Dialog

```tsx
// 24px corner, icon optional headline, scrim rgba(0,0,0,0.32)
// Actions: confirm + dismiss (text buttons right-aligned)
<MD3Dialog open={bool} onClose={...}>...</MD3Dialog>
```

### 2.10 MD3List + MD3ListItem

```tsx
// One-line | two-line | three-line variants
// Leading/trailing icon, divider optional
<MD3List><MD3ListItem headline="Item" supportingText="desc" /></MD3List>
```

### 2.11 MD3Snackbar

```tsx
// Inverse-surface bg, 4px corner, single line, auto-dismiss 4s
<MD3Snackbar message="Saved" action="UNDO" onActionClick={...} />
```

### 2.12 MD3ProgressIndicator

```tsx
// Variants: linear | circular; determinate | indeterminate
<MD3ProgressIndicator type="circular" value={75} />
```

## Shared Conventions (mọi component)

1. **Design tokens only** — không raw hex/px không qua token (trừ hit-area padding)
2. **State layers** — hover 8%, focus 12%, pressed 12%, dragged 16% (overlay `currentColor` opacity)
3. **Touch target ≥44px** — visual size có thể nhỏ hơn, hit area extends
4. **aria-* đầy đủ** — icon-only elements bắt buộc có aria-label
5. **prefers-reduced-motion** respect (transition none khi user yêu cầu)
6. **ForwardRef** — mọi component forward ref
7. **forward compatibility** — className prop merge, không override tokens

## Implementation Steps

1. Tạo `src/components/md3/` + từng component file (mỗi file < 200 lines)
2. Mỗi component: props interface + implementation + JSDoc
3. `__tests__/` — render test + a11y test (axe-core via vitest)
4. `index.ts` barrel export
5. `docs/m3-component-usage.md` — API + code samples từng component

## Todo

- [x] MD3Button + tests
- [x] MD3Card + tests
- [x] MD3Fab + tests
- [x] MD3Chip + tests
- [x] MD3NavigationBar(+Item) + tests
- [x] MD3TopAppBar + tests
- [x] MD3TextField + tests
- [x] MD3Switch + tests
- [x] MD3Dialog + tests
- [x] MD3List(+Item) + tests
- [x] MD3Snackbar + tests
- [x] MD3ProgressIndicator + tests
- [x] Barrel export + docs

## Success Criteria

- [x] 12 primitives render đúng M3 spec (variant, state, shape)
- [x] Unit tests pass (render + a11y) — 95/95 md3 tests + 3210/3210 full suite
- [x] Build green, existing tests (3210) green
- [x] Docs hoàn chỉnh — `docs/m3-component-usage.md`

## Risk Assessment

- **Medium:** M3 spec chi tiết — cần tham khảo material.io spec từng component để tránh sai lệch
- **Mitigation:** Mỗi component review spec trước khi code, test visual side-by-side với M3 gallery
