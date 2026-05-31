---
agent: css-brand-scan
scope: css/*.css (16 files)
issues_found: 188
critical: 14
timestamp: 2026-05-31
---

# CSS Brand Token Compliance Report

Scan of 16 CSS files (8,543 total lines) against Bazi v5 brand token system defined in `css/brand-tokens.css`.

---

## 1. HARDCODED HEX COLORS (157 instances across 13 files)

Colors used directly instead of `var(--token-name)`. Excludes `:root` variable definitions, `data:image` SVGs, and CSS comments.

### 1A. CRITICAL — Non-Brand Colors (Bazi-violating)

These colors are NOT in the Bazi palette and may introduce visual inconsistency or Bazi element conflict.

| File:Line | Value | Context | Suggested Token |
|-----------|-------|---------|-----------------|
| `styles.css:1436` | `#5A3E2B` | `.m3-filled-button:hover bg` | `var(--aura-chrome-dark)` (Kim, not Tho) |
| `styles.css:1459` | `#D4BBA5` | `.m3-tonal-button:hover bg` | `var(--aura-chrome-light)` |
| `styles.css:1464` | `#00FFFF` | `.neon-text color` | `var(--aura-chrome-bright)` (Cyan=Thuy ok, but use token) |
| `styles.css:1469` | `#00FFFF` | `.neon-cyan color` | `var(--aura-chrome-bright)` |
| `styles.css:1477` | `#FF00FF` | `.neon-magenta color` | **REMOVE** (Hoa element — khac Thuy) |
| `checkout-styles.css:311` | `#10b981` | `.summary-row.discount color` | `var(--aura-success)` |
| `track-order-styles.css:149` | `#f59e0b` | `.status-badge.pending color` | `var(--aura-chrome-mid)` (avoid amber/Hoa) |
| `track-order-styles.css:159` | `#ef4444` | `.status-badge.preparing color` | `var(--aura-danger)` |
| `track-order-styles.css:164` | `#22c55e` | `.status-badge.ready color` | `var(--aura-success)` |
| `track-order-styles.css:169` | `#06b6d4` | `.status-badge.delivered color` | `var(--aura-chrome-mid)` |
| `track-order-styles.css:174` | `#6b7280` | `.status-badge.cancelled color` | `var(--aura-text-muted)` |
| `kds-m3.css:72` | `#3A6F9F` | `.m3-chip.status-preparing color` | `var(--status-preparing)` |
| `kds-m3.css:82` | `#1E8048` | `.m3-chip.status-ready color` | `var(--aura-success)` |
| `pos.css:14` | `#1A1A1A` | `.wallet-phone-input bg` | `var(--aura-noir-void)` |

### 1B. HIGH — Brand Colors Used as Hardcoded Hex (should use tokens)

These values match the brand palette but bypass the token system, making them resistant to future palette changes.

| File | Count | Colors Used | Suggested Tokens |
|------|-------|-------------|------------------|
| `pos.css` | 22 | `#C9D6DF, #E8EEF3, #6B9FB8, #0A1A2E, #1A2A4E, #2D5A9E, #FAFAFA, #4A7A8A, #5A5A5A` | `var(--aura-chrome-*)`, `var(--aura-noir-*)`, `var(--aura-text-*)` |
| `hero-v8-bazi.css` (countdown) | 10 | `#C9D6DF, #6B9FB8, #E8EEF3, #334155, #3A6B80, #0A1A2E, #1A2A4E` | `var(--chrome-*)`, `var(--noir-*)` |
| `kds-styles.css` | 8 | `#C9D6DF, #E8EEF3, #3A6B80, #1A1A2E, #3A6F9F, #3A8F3A, #CC3333` | `var(--aura-chrome-*)`, `var(--aura-noir-*)` |
| `checkout-styles.css` | 16 | `#C9D6DF, #E8EEF3, #3A6B80, #1A1A2E, #FFFFFF` + payment icons | Use `var(--aura-chrome-*)` where possible |
| `mobile-responsive-v5.css` | 8 | `#E8EEF3, #C9D6DF, #0A1A2E, #C5C8CC` | `var(--aura-chrome-*)`, `var(--aura-noir-*)`, `var(--aura-text-*)` |
| `ui-enhancements.css` | 12 | `#C9D6DF, #E8EEF3, #3A6B80, #1A1A2E, #FFFFFF, #2a2a2a, #3a3a3a, #22c55e` | `var(--aura-chrome-*)`, `var(--aura-success)` |
| `brand-tokens.css` (utility classes) | 4 | `#0A1A2E, #E8EEF3, #C9D6DF, #6B9FB8` | `var(--aura-noir-deep)`, `var(--aura-chrome-*)` |
| `kds-m3.css` (chip text) | 5 | `#3A6B80, #C9D6DF` | `var(--status-*)` tokens already defined |
| `hero-aura.css` | 3 | `#FFFFFF, #C0C0C0, #888` | `var(--aura-chrome-bright)`, `var(--silver)` |
| `spaces-showcase.css` (dark tag) | 1 | `#00E5FF` | `var(--aura-chrome-mid)` (non-brand cyan) |
| `premium-upgrade.css` | 3 | `#F4F7FA, #050D1A, #FFFFFF` | `var(--bg-primary)`, `var(--aura-noir-void)` |
| `styles.css` (misc) | 5 | `#FFFFFF, #E8EEF3, #6B9FB8, #3A6B80, #fff` | Use `var(--aura-chrome-*)` |

### 1C. ACCEPTABLE — Print/Fallback Context

These hardcoded colors are acceptable in their context (print styles, CSS fallbacks).

| File | Count | Context |
|------|-------|---------|
| `print-receipt.css` | 10 | Receipt print — standalone thermal printer, no CSS vars |
| `mobile-responsive-v5.css:281-282` | 3 | `@media print` — `#000, #fff` |
| `kds-styles.css:916-921` | 2 | `@media print` — `#ccc` |
| `spaces-showcase.css:4-5` | 2 | CSS var with fallback: `var(--bg-main, #0E1420)` |
| `spaces-showcase.css:125` | 1 | CSS var with fallback: `var(--aura-chrome-mid, #6B9FB8)` |
| `checkout-styles.css:743-755` | 8 | Payment provider brand colors (MoMo, VNPay, PayOS, COD) — intentional third-party colors |

---

## 2. BROKEN/UNDEFINED CSS VARIABLE REFERENCES (CRITICAL)

These `var()` references point to tokens NOT defined in `brand-tokens.css` or `styles.css` `:root`.

| File | Variable | Lines | Status |
|------|----------|-------|--------|
| `checkout-styles.css` | `--warm-amber` | 100,129,138,182,187,270,275,324,351,375,468 | **UNDEFINED** — old gold-era token |
| `checkout-styles.css` | `--warm-gold` | 361 | **UNDEFINED** |
| `checkout-styles.css` | `--warm-coral` | 291 | **UNDEFINED** |
| `checkout-styles.css` | `--bg-dark` | 10,87,121,174,331,352,444 | **UNDEFINED** |
| `checkout-styles.css` | `--glass` | 41 | **UNDEFINED** (no bare `--glass` token) |
| `checkout-styles.css` | `--glass-border` | 44,55,88,238-239,315 | **UNDEFINED** (only defined in dark mode) |
| `checkout-styles.css` | `--transition-base` | 93,125,178,357,484 | **UNDEFINED** |
| `track-order-styles.css` | `--bg-secondary` | 10,250 | **UNDEFINED** |
| `track-order-styles.css` | `--card-bg` | 32,209 | **UNDEFINED** |
| `track-order-styles.css` | `--input-bg` | 56 | **UNDEFINED** |
| `track-order-styles.css` | `--text-on-primary` | 72 | **UNDEFINED** |
| `track-order-styles.css` | `--text-dim` | 87,253 | **UNDEFINED** |
| `track-order-styles.css` | `--warm-amber` | 63,71,80,102,216,217,257 | **UNDEFINED** |
| `track-order-styles.css` | `--border-color-light` | 289 | **UNDEFINED** |
| `track-order-styles.css` | `--border-color` | 37,53,100,118,210,224,271,315 | **MAY CONFLICT** with print-receipt.css local `:root` |
| `kds-styles.css:13` | `--aura-noir-mist` | 13 | **UNDEFINED** — no such token in brand-tokens.css |
| `styles.css:416` | `--warm-amber`, `--warm-gold` | 416 | **UNDEFINED** — `.gradient-text` broken |

**Impact:** These will render as fallback (transparent/initial/inherit), causing invisible text, missing borders, or broken backgrounds on the checkout page, order tracking page, and KDS.

---

## 3. BROKEN URL() REFERENCES

| File:Line | URL | Status |
|-----------|-----|--------|
| `hero-v8-bazi.css:178` | `../assets/brand/fnb_water_logo.png` | OK (file exists) |
| `spaces-showcase.css:78` | `../images/space_jade_counter.png` | OK |
| `spaces-showcase.css:81` | `../images/space_sky_deck.png` | OK |
| `spaces-showcase.css:84` | `../images/space_noir_cabin.png` | OK |
| `spaces-showcase.css:87` | `../images/space_aura_lounge.png` | OK |
| `spaces-showcase.css:90` | `../images/space_vip_steel_nest.png` | OK |

**Result:** 0 broken url() references.

---

## 4. BROKEN @import REFERENCES

**Result:** 0 `@import` statements found. All CSS is loaded via `<link>` in HTML.

---

## 5. DARK MODE COVERAGE

| File | Dark Mode Selectors | Status |
|------|-------|--------|
| `brand-tokens.css` | 1 (`[data-theme="dark"]`) | Core dark tokens |
| `styles.css` | 42 | Comprehensive |
| `premium-upgrade.css` | 26 | Comprehensive |
| `spaces-showcase.css` | 5 | Good |
| `ui-enhancements.css` | 5 | Good |
| `about-m3.css` | 0 | **MISSING** — dark mode-only `:root`, no light mode override |
| `checkout-styles.css` | 0 | **MISSING** — relies on undefined vars, no dark/light overrides |
| `hero-aura.css` | 0 | OK — hero is always dark themed |
| `hero-v8-bazi.css` | 0 | OK — hero is always dark themed |
| `kds-m3.css` | 0 | OK — KDS is dark-only by design |
| `kds-styles.css` | 0 | OK — KDS is dark-only by design |
| `mobile-responsive-v5.css` | 0 | OK — responsive overrides, theme-agnostic |
| `pos.css` | 0 | OK — POS is dark-only by design |
| `print-receipt.css` | 0 | OK — print is light-only by design |
| `track-order-styles.css` | 0 | **MISSING** — order tracking has no dark mode at all |
| `ui-polish-v5.css` | 0 | Uses dynamic tokens (`--bg`, `--card`, etc.) so inherits |

**Critical gaps:**
- `checkout-styles.css` — entire checkout page has no dark mode support
- `track-order-styles.css` — entire order tracking page has no dark mode support
- `about-m3.css` — redefines `:root` tokens as dark-only values, will conflict with main styles.css light mode

---

## 6. RESPONSIVE BREAKPOINT COVERAGE

| File | 320px | 375px | 480px | 768px | 1024px | 1440px+ | Verdict |
|------|-------|-------|-------|-------|--------|---------|---------|
| `styles.css` | Yes | Yes | - | Yes | Yes | Yes | Good |
| `mobile-responsive-v5.css` | - | - | Yes | Yes | Yes | Yes | Good (6 breakpoints) |
| `checkout-styles.css` | - | Yes | Yes | Yes | Yes | Yes | Good |
| `kds-styles.css` | - | Yes | Yes | Yes | Yes | Yes | Good |
| `track-order-styles.css` | - | Yes | Yes | Yes | Yes | Yes | Good |
| `hero-v8-bazi.css` | - | - | Yes | - | - | - | Minimal |
| `hero-aura.css` | - | - | - | Yes | - | - | Minimal |
| `spaces-showcase.css` | - | - | - | - | Yes (991px) | - | Minimal |
| `about-m3.css` | - | - | - | - | - | - | **NONE** |
| `kds-m3.css` | - | - | - | Yes | - | - | Minimal |
| `pos.css` | - | - | - | - | - | - | **NONE** (POS is tablet-only) |
| `print-receipt.css` | - | - | Yes (400px) | - | - | - | OK (receipt) |
| `ui-enhancements.css` | - | - | - | - | - | - | Uses `prefers-reduced-motion` only |
| `premium-upgrade.css` | - | - | - | - | - | - | Uses `prefers-reduced-motion` only |
| `brand-tokens.css` | - | - | - | - | - | - | Token file (no layout) |
| `ui-polish-v5.css` | - | - | Yes | Yes | - | Yes | Good |

---

## 7. FONT PRELOADING (FOUT Prevention)

| HTML File | Preloads WOFF2? | Preconnect? | Async CSS Load? | Verdict |
|-----------|-----------------|-------------|-----------------|---------|
| `index.html` | Yes (3 fonts) | - | - | Good |
| `menu.html` | Yes (4) | - | - | Good |
| `checkout.html` | Yes (4) | - | - | Good |
| `contact.html` | Yes (4) | - | - | Good |
| `loyalty.html` | Yes (4) | - | - | Good |
| `about-us.html` | Yes (5) | Yes | Yes | Best |
| `track-order.html` | Yes (4) | - | - | Good |
| `kds.html` | Yes (4) | - | - | Good |
| `success.html` | Yes (4) | - | - | Good |
| `failure.html` | Yes (4) | Yes | - | Good |
| `brand-guideline.html` | Yes (4) | - | - | Good |
| `dang-ky-thanh-vien.html` | Yes (4) | - | - | Good |
| `table-reservation.html` | Yes (4) | - | - | Good |
| `promotions.html` | Yes (4) | - | - | Good |
| `loyalty-calculator.html` | Yes (4) | - | - | Good |
| `hero-demo.html` | **No (0)** | - | - | **FOUT risk** |
| `404.html` | **No (0)** | - | - | **FOUT risk** |
| `checkin.html` | **No (0)** | - | - | **FOUT risk** |
| `receipt-template.html` | **No (0)** | - | - | OK (print, uses Roboto) |

---

## 8. TODO/FIXME/DEVELOPMENT COMMENTS

**Result:** 0 TODO/FIXME/HACK/XXX/TEMP comments found in any CSS file.

---

## SUMMARY BY SEVERITY

### CRITICAL (14 issues)
1. **17 undefined CSS variables** in `checkout-styles.css` (`--warm-amber`, `--warm-gold`, `--warm-coral`, `--bg-dark`, `--glass`, `--glass-border`, `--transition-base`) — checkout page rendering broken
2. **10 undefined CSS variables** in `track-order-styles.css` (`--bg-secondary`, `--card-bg`, `--input-bg`, `--text-on-primary`, `--text-dim`, `--warm-amber`, `--border-color-light`) — order tracking broken
3. **1 undefined CSS variable** in `kds-styles.css` (`--aura-noir-mist`) — KDS border missing
4. **2 undefined CSS variables** in `styles.css:416` (`--warm-amber`, `--warm-gold`) — `.gradient-text` broken
5. `#FF00FF` magenta in `styles.css:1477` — Hoa element, directly opposes Thuy Nhat chu
6. `#5A3E2B` brown in `styles.css:1436` — Tho element on button hover, khac Thuy
7. `#D4BBA5` tan in `styles.css:1459` — Tho element on tonal button hover
8. `#f59e0b` amber in `track-order-styles.css:149` — Hoa/Tho amber conflicts with Bazi v5
9. `#00FFFF` neon cyan in `styles.css:1464,1469` — not in token system
10. `#00E5FF` dynamic cyan in `spaces-showcase.css:130` — not in token system
11. Checkout page: zero dark mode support
12. Track-order page: zero dark mode support
13. `about-m3.css` redefines `:root` M3 tokens as dark-only values, conflicting with `styles.css` light mode
14. 3 HTML pages missing font preloads (FOUT risk): `hero-demo.html`, `404.html`, `checkin.html`

### HIGH (157 hardcoded hex values)
- 22 in `pos.css`
- 16 in `checkout-styles.css`
- 12 in `ui-enhancements.css`
- 10 in `hero-v8-bazi.css` (countdown)
- 8 in `mobile-responsive-v5.css`
- 8 in `kds-styles.css`
- 5 in `kds-m3.css`
- 5 in `styles.css`
- 4 in `brand-tokens.css` (utility classes)
- 3 in `hero-aura.css`
- 3 in `premium-upgrade.css`
- Remaining in print/fallback contexts (acceptable)

### LOW (0 issues)
- 0 broken url() references
- 0 broken @import references
- 0 TODO/FIXME comments

---

## RECOMMENDED PRIORITY FIX ORDER

1. **Define missing tokens** in `brand-tokens.css` `:root` — add `--warm-amber` as alias to `var(--aura-chrome-mid)`, `--bg-dark` as alias to `var(--aura-noir-deep)`, `--glass` / `--glass-border` / `--transition-base`, etc. (or refactor checkout/track-order to use existing tokens)
2. **Remove Bazi-violating colors** — `#5A3E2B`, `#D4BBA5` (Tho), `#FF00FF` (Hoa), `#f59e0b` (amber)
3. **Add dark mode** to `checkout-styles.css` and `track-order-styles.css`
4. **Fix `about-m3.css`** — scope its `:root` overrides to the about page only, or remove in favor of inheriting from `styles.css`
5. **Add font preloads** to `hero-demo.html`, `404.html`, `checkin.html`
6. **Replace hardcoded brand hex** with `var(--token)` across `pos.css`, `hero-v8-bazi.css` countdown, `mobile-responsive-v5.css`
