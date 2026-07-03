# A1: Design Token Consolidation

**Date:** 2026-07-03
**Status:** Planned
**Priority:** P1 Critical
**Source:** UI/UX Pro Max Audit #1 (Color System 5/10), #3 (Typography 3/10), #5 (UX Patterns 4/10)
**Effort:** 2-3 hours
**Dependencies:** None (Phase A entry point)
**Blocks:** A2 (components depend on correct @theme tokens)

---

## 1. Technical Design

### Problem Statement

The AURA CAFE codebase has three conflicting font families and a light-mode Tailwind @theme block on a dark-only site. These produce two distinct failure modes:

1. **Font fragmentation** — `brand-tokens.css` sets Plus Jakarta Sans for both display and body, while `global.css` `@theme` sets Cormorant Garamond + Space Grotesk. Pages that use CSS custom properties (`var(--aura-font-display)`) get the wrong font. Three files inline `font-[EB_Garamond,serif]` as a third serif.

2. **Light-mode Tailwind bleed** — `@theme` in `global.css` defines `--color-background: #F5F0EB` (warm cream) and `--color-foreground: #0A1628` (dark navy). Since `@theme` generates Tailwind utility classes (`bg-background`, `text-foreground`, `bg-primary`), generic components referencing these classes render light-mode colors on a dark navy (`#0A1A2E`) page background.

### Architecture

The fix operates at three layers:

```
Layer 1: brand-tokens.css ── Correct font-family CSS variables
Layer 2: global.css @theme ── Dark-mode Tailwind tokens
Layer 3: Per-page overrides ── Replace inline font-[EB_Garamond]
```

No new CSS files. No new components. Token propagation flows:
```
brand-tokens.css (:root CSS vars)
    ├── global.css (@theme maps CSS vars to Tailwind utilities)
    └── Components use Tailwind classes (font-display, bg-background) or CSS vars
```

### Key Design Decisions

1. **Google Fonts import** — Add `@import` for Cormorant Garamond + Space Grotesk so local woff2 fallback is not the only source. Keep local woff2 as primary (faster, no FOUT).

2. **Dark-only @theme** — AURA is dark-only per `use-aura-theme.ts:20`. Remove light-mode entries entirely. All Tailwind color utilities will reference dark variables.

3. **Legacy alias removal** — Remove gold-aliased CSS vars (`--aura-gold-*`, `--warm-amber`, etc.) from `brand-tokens.css` since they were deprecated in v5 migration and are now dead code. Retain only the silver-chrome aliases that map to current tokens.

---

## 2. File List

### Files to Modify

| File | Change | Impact |
|------|--------|--------|
| `src/styles/brand-tokens.css` | Replace font-family references: `Plus Jakarta Sans` → `Cormorant Garamond` (display), `Space Grotesk` (body). Remove legacy gold token aliases. Add Google Fonts `@import`. Fix headline-md from 20px to 24px. | ALL pages that consume CSS vars |
| `src/styles/global.css` | Rewrite `@theme` block to use dark-mode values: `--color-background: #0A1A2E`, `--color-foreground: #e8e8e8`, `--color-primary: #0d1b2a`, `--color-accent: #C9D6DF`. Align spacing/radius/animations with DESIGN.md. | ALL Tailwind utility class consumers |
| `src/styles/stitch-tokens.css` | Verify font-family vars match brand-tokens.css after fix. No change expected but must inspect. | Stitch components |
| `src/theme/aura-tokens.ts` | Update darkTokens fontFamily to match DESIGN.md (already correct but verify). Remove `lightTokens` or mark clearly as unused. | runtime theme hook |
| `src/theme/use-aura-theme.ts` | Remove unused `lightTokens` import. Current code already returns darkTokens always, but keep lightTokens accessible for future if needed. | runtime theme hook |
| `src/pages/AboutUs.tsx` | Replace `font-[EB_Garamond,serif]` with `font-display` throughout. | 1 page |
| `src/pages/Contact.tsx` | Same font fix. | 1 page |
| `src/pages/ReviewsPage.tsx` | Same font fix. | 1 page |
| `src/pages/BrandGuideline.tsx` | Replace `font-[EB_Garamond,serif]` with `font-display`. | 1 page |
| `DESIGN.md` | Document canonical chrome hex: pick `#C9D6DF` as single source (most widely used in CSS). Update DESIGN.md color spec. | Documentation |

### Files to Create

None. All changes are modifications to existing files.

---

## 3. Database Changes

None. This is a frontend-only CSS/font consolidation.

---

## 4. API Endpoints

None.

---

## 5. Frontend Components

No new components. Changes confined to:
- CSS variable definitions (brand-tokens.css, global.css, stitch-tokens.css)
- 4 pages replacing inline font overrides
- 2 theme files for font/color alignment

---

## 6. Tests

### Unit Tests

| Test | File | What to verify |
|------|------|----------------|
| Font CSS var propagation | `src/styles/__tests__/brand-tokens.test.ts` (new) | Verify `--aura-font-display` = Cormorant Garamond, `--aura-font-body` = Space Grotesk |
| Tailwind @theme correctness | Build check | `npm run build` must pass with 0 errors |
| No Plus Jakarta Sans refs | Grep | `grep -r "Plus Jakarta Sans" src/` should return 0 |

### E2E Tests

None needed for CSS changes alone. Visual regression covered by A5 variant plan.

### Build Verification

```
npm run build    # Must pass: 0 TS errors, 0 CSS parse errors
npm run lint     # Must pass
```

---

## 7. Acceptance Criteria

- [ ] `brand-tokens.css` `--aura-font-display` = `'Cormorant Garamond', Georgia, 'Times New Roman', serif`
- [ ] `brand-tokens.css` `--aura-font-body` = `'Space Grotesk', system-ui, -apple-system, sans-serif`
- [ ] `global.css` `@theme` `--color-background` = `#0A1A2E` (dark navy, not warm cream)
- [ ] `global.css` `@theme` `--color-foreground` = `#e8e8e8` (light gray, not dark navy)
- [ ] No Plus Jakarta Sans references remain in `src/`
- [ ] No EB Garamond font overrides remain in any file
- [ ] Headline-md uses 24px (not 20px)
- [ ] Legacy gold aliases removed from brand-tokens.css
- [ ] Chrome canonical hex = `#C9D6DF` documented in DESIGN.md
- [ ] `npm run build` passes with 0 errors
- [ ] `npm test` passes all 1184 existing tests (0 regression)

---

## 8. Rollback Plan

### If build fails
```bash
# Restore modified CSS files from git
git checkout -- src/styles/brand-tokens.css
git checkout -- src/styles/global.css
git checkout -- src/theme/aura-tokens.ts
```

### If fonts render incorrectly in production
```bash
# Revert per-page font overrides
git checkout -- src/pages/AboutUs.tsx
git checkout -- src/pages/Contact.tsx
git checkout -- src/pages/ReviewsPage.tsx
```

### Global rollback
```bash
# Revert all A1 changes
git checkout HEAD~5 -- src/styles/ src/theme/ src/pages/AboutUs.tsx src/pages/Contact.tsx src/pages/ReviewsPage.tsx
npm run build
npm test
```

### Post-rollback validation
1. Verify `npm run build` passes
2. Verify `npm test` passes
3. Verify `font-display` and `font-body` CSS vars show old values

---

## 9. Estimated Effort

| Task | Time |
|------|------|
| brand-tokens.css font fixes + Google Fonts import + gold alias removal | 30 min |
| global.css @theme dark-mode rewrite | 15 min |
| Verify stitch-tokens.css alignment | 5 min |
| aura-tokens.ts / use-aura-theme.ts updates | 5 min |
| Fix font overrides in 4 pages | 15 min |
| DESIGN.md chrome hex documentation | 5 min |
| Build + test verification | 15 min |
| **Total** | **~1.5-2h** |
