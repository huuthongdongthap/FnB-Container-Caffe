# Design Audit Report — AURA CAFE Brand Token Compliance

**Date:** 2026-04-30  
**Scope:** 11 HTML pages + 9 CSS files vs `css/brand-tokens.css` v4.0  
**Official Brand:** AURA CAFE — 水 Thủy (Water) Noir Lounge  
**Official Gold:** `#D4AF37` (Gold Metallic) | **Official Navy:** `#1A1A2E`

---

## Executive Summary

**3 critical violation categories** found across the codebase:

| Severity | Issue | Files Affected | Occurrences |
|----------|-------|---------------|-------------|
| 🔴 CRITICAL | `#C0C0C0` silver masquerading as gold | 5 HTML pages | ~20 |
| 🔴 CRITICAL | `#C9A200` old gold (not brand token) | 3 HTML pages, root overrides | ~50 |
| 🔴 CRITICAL | `rgba(201,162,0,...)` old gold rgba | 8 HTML pages, 4 CSS files | ~75 |
| 🔴 CRITICAL | `#C9A962` / `rgba(201,169,98,...)` variant | 5 CSS files | ~30 |
| 🟡 HIGH | `#0A0A0A` / `#1A1A1A` old backgrounds | 7 HTML pages | ~15 |
| 🟡 HIGH | `#9E9E9E` old text body | 5 HTML pages | ~5 |
| 🟠 MEDIUM | `#B8941F` wrong gold variant | 3 CSS files | ~3 |
| 🟠 MEDIUM | No CSS file imports `brand-tokens.css` | ALL 9 CSS files | Systemic |

**Total violations: ~200+ across 11 HTML pages and 9 CSS files**

---

## HTML Pages — Detailed Findings

### 🔴 index.html (~791 inline style lines)

| Line | Violation | Current Value | Should Be |
|------|-----------|---------------|-----------|
| 13 | theme-color meta | `#0A0A0A` | `#1A1A2E` |
| 22 | `--bg-primary` | `#0A0A0A` | `#1A1A2E` |
| 23 | `--bg-surface` | `#1A1A1A` | `#151A28` |
| 24 | **`--gold-master`** | **`#C9A200`** | **`#D4AF37`** |
| 27 | `--amber-neon` | `#FFB300` | `#FFB380` |
| 28 | `--text-body` | `#9E9E9E` | `#B0B0B0` |
| 30 | `--gradient-gold` | `linear-gradient(135deg, #C9A200, #FFD700)` | `linear-gradient(135deg, #D4AF37, #FFD700)` |
| 31 | `--glow-gold` | `rgba(201,162,0,0.15)` | `rgba(212,175,55,0.18)` |
| 32 | `--border-gold` | `rgba(201,162,0,0.2)` | `rgba(212,175,55,0.15)` |
| ~25x | `rgba(201,162,0,...)` | scattered throughout | `rgba(212,175,55,...)` |

### 🔴 menu.html (~168 inline style lines)

| Line | Violation | Current Value | Should Be |
|------|-----------|---------------|-----------|
| 14 | `--bg` | `#0A0A0A` | `#1A1A2E` |
| 14 | `--surface` | `#1A1A1A` | `#151A28` |
| 15 | **`--gold`** | **`#C9A200`** | **`#D4AF37`** |
| 15 | `--amber` | `#FFB300` | `#FFB380` |
| 17 | `--txt` | `#9E9E9E` | `#B0B0B0` |
| 19 | `--grad` | `linear-gradient(135deg,#C9A200,#FFD700)` | `linear-gradient(135deg,#D4AF37,#FFD700)` |
| 20 | `--glow` | `rgba(201,162,0,.15)` | `rgba(212,175,55,0.18)` |
| ~17x | `rgba(201,162,0,...)` | scattered | `rgba(212,175,55,...)` |

### 🔴 contact.html (~86 inline style lines)

| Line | Violation | Current Value | Should Be |
|------|-----------|---------------|-----------|
| 14 | `--bg` | `#0A0A0A` | `#1A1A2E` |
| 14 | `--surface` | `#1A1A1A` | `#151A28` |
| 15 | **`--gold`** | **`#C9A200`** | **`#D4AF37`** |
| 16 | `--cyan` | `#00BCD4` | `var(--aura-info)` |
| 17 | `--txt` | `#9E9E9E` | `#B0B0B0` |
| 18 | `--grad` | `linear-gradient(135deg,#FFB300,#FFD700)` | `linear-gradient(135deg,#D4AF37,#FFD700)` |

### ⛔ checkout.html (~133 inline style lines) — SILVER AS GOLD

| Line | Violation | Current Value | Should Be |
|------|-----------|---------------|-----------|
| 14 | `--bg` | `#0A0F1F` | `#1A1A2E` |
| 14 | `--surface` | `#1A1F35` | `#151A28` |
| 15 | **`--gold`** | **`#C0C0C0`** ⛔ | **`#D4AF37`** |
| 15 | **`--gold-e`** | **`#E0E0E0`** ⛔ | **`#FFD700`** |
| 19 | **`--grad`** | **`linear-gradient(135deg,#C0C0C0,#E0E0E0)`** ⛔ | **`linear-gradient(135deg,#D4AF37,#FFD700)`** |
| 20 | `--grad-amber` | `linear-gradient(135deg,#FFB380,#E0E0E0)` | `linear-gradient(135deg,#FFB380,#FFD700)` |
| 322 | **`rgba(201,169,98,...)`** | `#C9A84C` variant ⛔ | `rgba(212,175,55,...)` |

### ⛔ loyalty.html (~199 inline style lines) — SILVER AS GOLD

| Line | Violation | Current Value | Should Be |
|------|-----------|---------------|-----------|
| 19 | `--bg-primary` | `#0A0F1F` | `#1A1A2E` |
| 20 | `--bg-surface` | `#1A1F35` | `#151A28` |
| 22 | **`--gold-master`** | **`#C0C0C0`** ⛔ | **`#D4AF37`** |
| 23 | **`--gold-electric`** | **`#E0E0E0`** ⛔ | **`#FFD700`** |
| 24 | **`--gold-dim`** | **`rgba(201,162,0,0.3)`** | **`rgba(212,175,55,0.3)`** |
| 28 | **`--gradient-gold`** | **`linear-gradient(135deg,#C0C0C0,#E0E0E0)`** ⛔ | **`linear-gradient(135deg,#D4AF37,#FFD700)`** |
| 29 | **`--glow-gold`** | **`rgba(201,162,0,0.15)`** | **`rgba(212,175,55,0.18)`** |

### ⛔ table-reservation.html (~135 inline style lines) — SILVER AS GOLD

| Line | Violation | Current Value | Should Be |
|------|-----------|---------------|-----------|
| 14 | `--bg` | `#0A0F1F` | `#1A1A2E` |
| 14 | `--surface` | `#1A1F35` | `#151A28` |
| 15 | **`--gold`** | **`#C0C0C0`** ⛔ | **`#D4AF37`** |
| 15 | **`--gold-e`** | **`#E0E0E0`** ⛔ | **`#FFD700`** |
| 18 | **`--grad`** | **`linear-gradient(135deg,#C0C0C0,#E0E0E0)`** ⛔ | **`linear-gradient(135deg,#D4AF37,#FFD700)`** |

### ⛔ kds.html (~49 inline style lines) — SILVER AS GOLD

| Line | Violation | Current Value | Should Be |
|------|-----------|---------------|-----------|
| 17 | `--bg` | `#0A0F1F` | `#1A1A2E` |
| 17 | `--card` | `#1A1F35` | `#151A28` |
| 17 | **`--gold`** | **`#C0C0C0`** ⛔ | **`#D4AF37`** |
| 18 | **`--electric-gold`** | **`#E0E0E0`** ⛔ | **`#FFD700`** |
| 23 | `rgba(201,162,0,.3)` | old gold | `rgba(212,175,55,0.3)` |

### ⛔ success.html (~354 inline style lines) — SILVER AS GOLD + C9A84C

| Line | Violation | Current Value | Should Be |
|------|-----------|---------------|-----------|
| 109 | **`--gold`** | **`#C0C0C0`** ⛔ | **`#D4AF37`** |
| 110 | **`--gold-bright`** | **`#E0E0E0`** ⛔ | **`#FFD700`** |
| 111 | `--dark-bg` | `#0A0F1F` | `#1A1A2E` |
| 130,137,163,211,268 | **`rgba(201,169,98,...)`** | **`#C9A84C` variant** ⛔ | `rgba(212,175,55,...)` |
| 272 | `#B8941F` | old gold variant | `#B8860B` |

### 🟡 about-us.html (~290 inline style lines)

| Issue | Detail |
|-------|--------|
| M3 coffee theme | Uses `--coffee-primary`, `--coffee-dark` — NOT brand tokens |
| `#FFFFFF` | Should use `var(--white)` or `var(--aura-text-primary)` |
| Font: Space Grotesk | NOT in brand tokens (should be Manrope/Inter) |
| Font: Cormorant Garamond | NOT in brand tokens (should be Playfair Display) |

### 🟡 brand-guideline.html (~434 inline style lines)

| Line | Violation | Current Value | Should Be |
|------|-----------|---------------|-----------|
| 568 | Shows `#C9A200` as "Gold Master" | **Self-contradicts `brand-tokens.css`** | `#D4AF37` |
| 37,108,389 | `rgba(201,162,0,...)` | old gold | `rgba(212,175,55,...)` |
| 116,262,439 | `#0A0A0A` | old bg | `#1A1A2E` |

### ✅ track-order.html

**CLEAN** — No inline `<style>` block. Uses external CSS only.

---

## CSS Files — Detailed Findings

### styles.css (2107 lines) — 🔴 HEAVY (18 violations)

| Line | Violation | Fix |
|------|-----------|-----|
| 19 | `--md-sys-color-tertiary: #C9A962` | → `#D4AF37` |
| 53 | `--coffee-accent: #C9A962` | → `#D4AF37` |
| 188-196 | M3 bg colors `#0A0A0A`, `#111111`, `#0F0F0F`, `#141414`, `#1A1A1A` | → Navy tokens |
| 212 | `--cyber-glow: rgba(201,169,98,0.5)` | → `rgba(212,175,55,0.5)` |
| 213 | `--cyber-gradient: linear-gradient(135deg, #FFD700, #C9A962)` | → `linear-gradient(135deg, #FFD700, #D4AF37)` |
| 613 | `rgba(201,169,98,0.6)` | → `rgba(212,175,55,0.6)` |
| 2032 | `linear-gradient(135deg, #FFD700, #C9A962)` | → `linear-gradient(135deg, #FFD700, #D4AF37)` |

### premium-upgrade.css (264 lines) — 🔴 HEAVIEST per line (16 violations)

| Lines | Pattern | Count |
|-------|---------|-------|
| 21,27,40-42,78,115,135,142-143,202,229 | `rgba(201,169,98,...)` | 15 |
| 201 | `#C9A962` | 1 |
| 212 | `linear-gradient(90deg, transparent, #C9A962, transparent)` | 1 |

### about-m3.css (70 lines) — 🔴 DIVERGENT (entire file)

Entire M3 purple theme `:root` diverges from brand tokens. All colors are Material 3 purple-based, not Noir/Gold.

### checkout-styles.css (847 lines) — 🔴 HEAVY (11 violations)

- `#C9A962` → `#D4AF37` (lines 488, 496, 503-505)
- `#0A0A0A` → `#1A1A2E` (line 489)
- `#B8941F` → `#B8860B` (gradient stops)

### kds-m3.css (216 lines) — 🔴 DIVERGENT

Entire M3 purple `:root` diverges from brand tokens.

### kds-styles.css (923 lines) — 🔴 DIVERGENT

Defines own `--kds-*` color system using Tailwind slate/blue palette, not brand tokens.

### ui-enhancements.css (697 lines) — 🔴 HEAVY (7 brand violations)

- `#C9A962` → `#D4AF37`
- `#0A0A0A` → `#1A1A2E`
- `rgba(201,169,98,...)` not found but gradients reference `#C9A962`

### print-receipt.css (389 lines) — 🟡 MODERATE (1 critical)

- Line 12: `--coffee-accent: #C9A962` → `#D4AF37`

### track-order-styles.css (536 lines) — 🟡 MODERATE

- Uses Tailwind-style status colors rather than brand tokens. Functional for status UI but visually inconsistent.

---

## Fix Priority Matrix

### P0 — Immediate (breaks brand identity)

| # | Fix | Files | Impact |
|---|-----|-------|--------|
| 1 | `#C0C0C0`/`#E0E0E0` → `#D4AF37`/`#FFD700` (silver→gold) | checkout, loyalty, table-reservation, kds, success | 5 pages show silver instead of gold |
| 2 | `#C9A200` → `#D4AF37` (old gold) | index, menu, contact + root overrides | Gold appears wrong shade on 3 pages |
| 3 | `rgba(201,162,0,...)` → `rgba(212,175,55,...)` | ~75 occurrences across HTML+CSS | Every glow/shadow/border uses wrong gold |
| 4 | `rgba(201,169,98,...)` → `rgba(212,175,55,...)` | ~30 occurrences across CSS | Old gold variant in shadows/highlights |

### P1 — High (visual inconsistency)

| # | Fix | Files | Impact |
|---|-----|-------|--------|
| 5 | `#0A0A0A`/`#1A1A1A` → `#1A1A2E`/`#202640` | 7 HTML pages + styles.css | Backgrounds too dark, wrong hue |
| 6 | `#9E9E9E` → `#B0B0B0` | 5 HTML pages | Text too dark/dimmer than brand spec |
| 7 | `#C9A962` → `#D4AF37` | 5 CSS files | Old gold in CSS properties |
| 8 | `#B8941F` → `#B8860B` | 3 CSS files | Wrong gold-cool shade |

### P2 — Systemic (architectural)

| # | Fix | Files | Impact |
|---|-----|-------|--------|
| 9 | Make all CSS files import/use `brand-tokens.css` | ALL 9 CSS files | No file currently imports tokens |
| 10 | Remove local `:root` overrides in HTML `<style>` blocks | 8 HTML pages | Pages override brand tokens |
| 11 | Replace M3 purple themes in about-m3.css, kds-m3.css | 2 CSS files | Completely divergent design system |
| 12 | Replace KDS slate/blue palette in kds-styles.css | 1 CSS file | Separate color system |

---

## Automated Fix Commands

```bash
# P0: Replace silver-as-gold in HTML pages
# checkout.html, loyalty.html, table-reservation.html, kds.html, success.html
# #C0C0C0 → #D4AF37, #E0E0E0 → #FFD700

# P0: Replace old gold #C9A200 → #D4AF37
# index.html, menu.html, contact.html

# P0: Replace old gold rgba
# rgba(201,162,0, → rgba(212,175,55,
# rgba(201,169,98, → rgba(212,175,55,

# P0: Replace old gold hex in CSS
# #C9A962 → #D4AF37
# #B8941F → #B8860B

# P1: Replace old bg colors
# #0A0A0A → #1A1A2E
# #1A1A1A → #151A28
# #9E9E9E → #B0B0B0
```

---

*Report generated by Mekong CLI / Design Review Pipeline*