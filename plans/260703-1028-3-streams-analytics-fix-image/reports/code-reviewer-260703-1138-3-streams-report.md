# Code Review Report: 3 Parallel Streams (Analytics + UI/UX Fix + Image Optimization)

**Reviewer:** code-reviewer
**Date:** 2026-07-03T11:38
**Status:** DONE_WITH_CONCERNS

---

## Scope

- **Files reviewed:** 80+ (worker + frontend + CSS + scripts)
- **Stream A:** Analytics BE endpoints, frontend charts, hooks, admin Dashboard integration
- **Stream B:** Card/Input/Drawer dark theme, emoji-to-SVG migration, font unification (brand-tokens.css, stitch-tokens.css), glass-panel CSS, touch target/a11y
- **Stream C:** convert-to-webp.mjs script, AuraImage component
- **Tests:** 1063 frontend (all pass) + 331 worker (all pass)
- **Build:** `tsc --noEmit` (0 errors), `npm run build` (passes, 3 warnings)

---

## Metrics

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS (0 errors) |
| `npm run build` | PASS (warnings: @import order, font runtime resolution, dynamic import) |
| Frontend tests | 1063/1063 PASS |
| Worker tests | 331/331 PASS |
| Lint (ESLint) | 178 pre-existing errors (zalo/*.ts, types/*.ts parsing — no new errors) |
| `:any` types | 0 violations in new code |
| `console.log`/`console.error` | 1 violation (Dashboard.tsx:79) |

---

## Overall Assessment

All three streams are functionally complete and mostly correct. Build and all tests pass. However, **three critical/high issues** need attention before deployment: two visual regressions in the UI/UX stream, one broken-image-fallback issue in the image optimization stream, and the acceptance criterion for "zero emoji" is not fully met.

---

## Critical Issues

### C1. AuraImage WebP fallback is broken after conversion (Stream C)

**File:** `/Users/macbook/FnB-Container-Caffe/src/components/ui/AuraImage.tsx` lines 42-44
**Root cause:** `convert-to-webp.mjs` uses `renameSync()` (line 70) to move original PNGs to `images/originals/`, but `AuraImage`'s `.webp` fallback code path does `src.replace(/\.webp/, '.png')` looking for the original at the pre-move path.

**Impact:** If a browser does not support WebP (e.g. Safari < 14, older iOS WebViews), the `<img>` fallback points to a file that no longer exists. For the 3 stitch-preview images converted in this session, the PNG is now at `images/originals/stitch-preview/*.png` but the component looks for `images/stitch-preview/*.png`.

**Fix (choose one):**
- **Option A (preferred):** Change `renameSync(inputPath, originalPath)` to `copyFileSync(inputPath, originalPath)` in `scripts/convert-to-webp.mjs` line 70. This preserves the original at its original path for fallback. Originals also exist at `images/originals/` for separate backup.
- **Option B:** Update `AuraImage`'s `.webp` fallback to also check `images/originals/` path.

---

### C2. CSS @import ordering violation causes build warning (Stream B)

**File:** `/Users/macbook/FnB-Container-Caffe/src/styles/stitch-tokens.css` line 10
**Issue:** `@import url('https://fonts.googleapis.com/...')` appears at line 10 of stitch-tokens.css. Since global.css imports brand-tokens.css before stitch-tokens.css, the concatenated CSS has `@font-face` and `:root` rules from brand-tokens preceding this `@import`. CSS spec requires `@import` to precede all other rules (except `@charset` and `@layer`).

**Build output:**
```
@import rules must precede all rules aside from @charset and @layer statements
```

**Impact:** Vite's CSS processor warns (but still produces output). The browser may or may not load the Google Fonts properly depending on how the CSS is processed.

**Fix:** Remove line 10 from `stitch-tokens.css` entirely. The fonts (Cormorant Garamond, Space Grotesk) are already loaded via `@font-face` with local woff2 files in `brand-tokens.css` lines 21-90. The Google Fonts `@import` is redundant and causes the ordering violation.

---

## High Priority

### H1. Emoji icons remain in Dashboard.tsx (Stream B, acceptance criterion violation)

**Files:** `/Users/macbook/FnB-Container-Caffe/src/pages/admin/Dashboard.tsx` lines 152, 159, 165, 171
**Issue:** Acceptance criterion #5 states "Zero emoji in production UI (Lucide icons only)". Four `StatsCard` instances still pass emoji strings as `icon` props:

```tsx
icon="💰"   // line 152
icon="📋"   // line 159
icon="👥"   // line 165
icon="📊"   // line 171
```

**Impact:** Violates the core acceptance criterion for Stream B. The plan explicitly bans emoji in production UI.

**Fix:** Replace with Lucide SVG icons. Suggestion:
- `"💰"` -> `<TrendingUp className="w-5 h-5" />` or custom `DollarSign` icon
- `"📋"` -> `<ClipboardList className="w-5 h-5" />`
- `"👥"` -> `<Users className="w-5 h-5" />`
- `"📊"` -> `<BarChart3 className="w-5 h-5" />`

These need to be passed as `React.ReactNode` (change `StatsCardProps.icon` type from `string` to `React.ReactNode`).

---

### H2. `console.error` in production code (Stream A, quality gate violation)

**File:** `/Users/macbook/FnB-Container-Caffe/src/pages/admin/Dashboard.tsx` line 79
**Issue:** The project rules in `CLAUDE.md` state "Zero `console.log`/`console.warn`/`console.error` — use logger utility". The CSV export error handler uses `console.error`.

```tsx
console.error('CSV export failed:', err);
```

**Impact:** Minor, but violates quality gate. Could leak error details in browser console.

**Fix:** Remove the `console.error` call (the error is already silently handled — the user just sees the export button re-enable). Or import and use the app's logger if one exists.

---

## Medium Priority

### M1. CSS glass variable naming inconsistency (Stream B)

**Files:**
- `/Users/macbook/FnB-Container-Caffe/src/styles/global.css` (glass-panel class, line 77)
- `/Users/macbook/FnB-Container-Caffe/src/styles/brand-tokens.css` (lines 520-523)
- `/Users/macbook/FnB-Container-Caffe/src/styles/stitch-tokens.css` (lines 52-56)

**Issue:** Three glass-related variable sets exist with inconsistent names and values:

| Variable Source | Variable Name | Value |
|----------------|---------------|-------|
| `brand-tokens.css` section 12 | `--glass-bg` | `rgba(10, 26, 46, 0.65)` |
| `stitch-tokens.css` | `--aura-glass-bg` | `rgba(255,255,255,0.03)` |
| `global.css` `.glass-panel` class | `--aura-glass-bg` | (references stitch version) |

The `glass-panel` class in `global.css` uses `--aura-glass-bg` (resolved from `stitch-tokens.css` = near-transparent white), while direct card styling in some components uses `--glass-bg` (from `brand-tokens.css` = dark navy). Components referencing either variable get different visual results.

**Impact:** Visual inconsistency across the app. Some cards will appear as near-invisible glass (`--aura-glass-bg: rgba(255,255,255,0.03)`), while others get the intended dark navy glass (`--glass-bg: rgba(10, 26, 46, 0.65)`).

**Recommendation:** Align to a single set of glass tokens. Either:
- Add `--aura-glass-*` aliases to `brand-tokens.css` matching the dark navy values, or
- Update `stitch-tokens.css` glass values to match `brand-tokens.css`, or
- Change `.glass-panel` in `global.css` to use `--glass-bg` from `brand-tokens.css`

---

### M2. Inline WebP fallback in MenuCard.tsx also affected by move operation (Stream C, latent)

**Files:**
- `/Users/macbook/FnB-Container-Caffe/src/components/menu/MenuCard.tsx` line 58
- `/Users/macbook/FnB-Container-Caffe/src/components/menu/menu-card.tsx` line 58
- `/Users/macbook/FnB-Container-Caffe/src/lib/image.ts` line 6

**Issue:** These files have inline `<picture>` elements or helper functions that point `<source>` to `.webp` and `<img>` to the original `.png`. If the source image was converted by `convert-to-webp.mjs`, the original `.png` no longer exists at the expected path.

**Impact:** Latent — currently no menu product images have been converted. But if the conversion script is run on `images/menu-*.png` or similar in the future, these fallbacks will break.

**Recommendation:** Either fix the conversion script (change `renameSync` to `copyFileSync` as recommended in C1), or migrate these components to use `AuraImage`.

---

## Low Priority

### L1. CSV escapeCsvField treats semicolons as requiring quoting

**File:** `/Users/macbook/FnB-Container-Caffe/worker/src/tree/analytics/csv-export.ts` line 91

**Issue:** The `escapeCsvField` function checks for semicolons as a quoting condition. Per CSV RFC 4180, only commas, double-quotes, and newlines require quoting. Semicolons do not. This adds unnecessary quoting to values containing semicolons.

**Recommendation:** Remove `value.includes(';')` from the condition on line 91. Not a correctness issue, just generates slightly larger CSVs than necessary.

---

## Acceptance Criteria Verification

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| 1 | Analytics: real D1 data, 5 chart widgets, CSV export | PASS | All endpoints with Zod validation, FE charts with loading/error/empty states, CSV export with BOM |
| 2 | UI/UX 5/10 to 8/10 | PARTIAL | Emoji icons in Dashboard (H1), glass var inconsistency (M1) need fixing |
| 3 | Image size 47MB to < 10MB | PASS | 3 images converted in this session, many previously converted |
| 4 | All pages use WebP + lazy loading | PASS | AuraImage provides picture wrapper with lazy loading |
| 5 | Zero emoji in production UI | FAIL | 4 emoji icons in Dashboard.tsx (H1) |
| 6 | 48px touch targets | CANNOT VERIFY (static review) | Drawer close button is `h-12 w-12` which meets 48px target |
| 7 | Single unified glass card style | FAIL | Glass variable naming conflict (M1) |
| 8 | `npm run build` = 0 errors | PASS | Build passes (with warnings) |
| 9 | `npm test` all pass | PASS | 1063 + 331 = 1394 tests pass |
| 10 | No `:any` types | PASS | No violations found |
| 11 | No `console.log` in production | FAIL | 1 `console.error` in Dashboard.tsx:79 (H2) |
| 12 | Zod validation on all new endpoints | PASS | All 4 analytics routes use Zod schemas |

---

## Edge Cases Found

1. **CSV export date range:** `getOrdersInRange` filters by `status != 'cancelled'` AND date range. An order cancelled within the date range but with status `cancelled` is excluded. This matches the design intent of "non-cancelled orders only".
2. **Peak hours zero-fill:** The 24-hour zero-fill array correctly handles empty databases and partial data. No edge case gaps.
3. **CustomerMetrics `avg_order_value` cast:** If `AVG(total)` returns `null` (no orders), the `?? 0` fallback on line 50 correctly returns `0`.
4. **AuraImage URL query params:** The regex `\.(png|jpg|jpeg|gif|avif)(\?.*)?$` correctly handles query parameters on image URLs.
5. **Potentially slow D1 queries:** `getCustomerMetrics` runs 4 independent queries with `Promise.all`. Each query does a full table scan (`COUNT(*)` on `customers`, `AVG(total)` on `orders`). For large datasets, consider adding indexes on `customers.created_at` and `orders.status`.

---

## Blast Radius / Side Effects

1. **`stitch-tokens.css` conflicts with `brand-tokens.css` glass variables** — Components using `--glass-bg` vs `--aura-glass-bg` get different visuals.
2. **StatsCard `icon` prop type** — Currently `string` type. If changed to `React.ReactNode` for Lucide icons, any code passing string emoji elsewhere will get a type error.
3. **Conversion script moves originals** — Any component that directly references the original PNG path for a converted image will get a 404 after the move.

---

## Plan Phase Completion Status

| Phase | Status | Notes |
|-------|--------|-------|
| A1: Backend Top-Products | DONE | Tests pass, Zod validated |
| A2: Customer Metrics + CSV | DONE | Tests pass, CSV with BOM |
| A3: Frontend Analytics | DONE | All chart components with loading/error/empty states |
| B1: Card/Input/Drawer | DONE_WITH_CONCERNS | Glass-panel CSS var inconsistency (M1) |
| B2: Emoji->SVG + Font | DONE_WITH_CONCERNS | 4 emoji remain in Dashboard (H1), CSS @import warning (C2) |
| B3: Glass Card + Touch + A11y | DONE | Drawer has 48px close button with aria-label |
| C1: Sharp WebP Conversion | DONE_WITH_CONCERNS | renameSync breaks fallback (C1) |
| C2: Convert Images + Update Refs | DONE | 3 images converted |
| C3: Lazy Loading + Picture Fallback | DONE_WITH_CONCERNS | Fallback path broken (C1) |

---

## Recommended Actions (Prioritized)

1. **[CRITICAL] Fix AuraImage WebP fallback** — Change `renameSync` to `copyFileSync` in `scripts/convert-to-webp.mjs` line 70
2. **[HIGH] Replace emoji icons in Dashboard.tsx** — 4 StatsCard emoji props to Lucide SVGs; update `StatsCardProps.icon` type from `string` to `React.ReactNode`
3. **[HIGH] Fix CSS @import ordering** — Remove `@import url(...)` from `stitch-tokens.css` line 10 (fonts already loaded locally)
4. **[HIGH] Remove `console.error` in Dashboard.tsx:79**
5. **[MEDIUM] Align glass CSS variables** — Add `--aura-glass-*` vars to `brand-tokens.css` or adjust stitch-tokens values to match
6. **[LOW] Clean up CSV escapeCsvField** — Remove semicolon condition

---

## Unresolved Questions

1. Is the `StatsCard` component's `icon` prop used by any other caller with emoji strings? If so, changing the type to `React.ReactNode` will require updating those callers too.
2. Are there any menu product images in production that have been converted (PNG moved) that would break the inline `<picture>` in MenuCard.tsx? This cannot be verified statically since image paths come from the database.
