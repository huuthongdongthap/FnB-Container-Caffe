# CSS Issues Report — AURA CAFE Brand Token Compliance

**Date:** 2026-04-30  
**Scope:** 9 CSS files + 11 HTML inline styles  
**Reference:** `css/brand-tokens.css` v4.0 (Gold #D4AF37, Navy #1A1A2E)

---

## Summary

| Metric | Value |
|--------|-------|
| Total files audited | 20 (9 CSS + 11 HTML inline) |
| Total violations found | ~200 |
| CRITICAL | 4 categories (~145 occurrences) |
| HIGH | 4 categories (~30 occurrences) |
| MEDIUM | 4 categories (~25 occurrences) |

---

## Issue Categories

### 🔴 CRITICAL-01: Silver Masquerading as Gold (`#C0C0C0` / `#E0E0E0`)

**Impact:** 5 HTML pages render silver/gray instead of gold. Brand identity broken.

| File | Lines | Token Override | Current | Should |
|------|-------|---------------|---------|--------|
| checkout.html | L15 | `--gold` | `#C0C0C0` | `#D4AF37` |
| checkout.html | L15 | `--gold-e` | `#E0E0E0` | `#FFD700` |
| checkout.html | L19 | `--grad` | `linear-gradient(135deg,#C0C0C0,#E0E0E0)` | `linear-gradient(135deg,#D4AF37,#FFD700)` |
| loyalty.html | L22 | `--gold-master` | `#C0C0C0` | `#D4AF37` |
| loyalty.html | L23 | `--gold-electric` | `#E0E0E0` | `#FFD700` |
| loyalty.html | L28 | `--gradient-gold` | `linear-gradient(135deg,#C0C0C0,#E0E0E0)` | `linear-gradient(135deg,#D4AF37,#FFD700)` |
| table-reservation.html | L15 | `--gold` | `#C0C0C0` | `#D4AF37` |
| table-reservation.html | L15 | `--gold-e` | `#E0E0E0` | `#FFD700` |
| table-reservation.html | L18 | `--grad` | `linear-gradient(135deg,#C0C0C0,#E0E0E0)` | `linear-gradient(135deg,#D4AF37,#FFD700)` |
| kds.html | L17 | `--gold` | `#C0C0C0` | `#D4AF37` |
| kds.html | L18 | `--electric-gold` | `#E0E0E0` | `#FFD700` |
| success.html | L109 | `--gold` | `#C0C0C0` | `#D4AF37` |
| success.html | L110 | `--gold-bright` | `#E0E0E0` | `#FFD700` |

**Fix:** Global replace in each HTML file's `<style>` block.

---

### 🔴 CRITICAL-02: Old Gold `#C9A200`

**Impact:** 3 HTML pages define `--gold`/`--gold-master` as old gold, wrong shade.

| File | Lines | Token | Current | Should |
|------|-------|-------|---------|--------|
| index.html | L24 | `--gold-master` | `#C9A200` | `#D4AF37` |
| index.html | L30 | `--gradient-gold` | `linear-gradient(135deg, #C9A200, #FFD700)` | `linear-gradient(135deg, #D4AF37, #FFD700)` |
| menu.html | L15 | `--gold` | `#C9A200` | `#D4AF37` |
| menu.html | L19 | `--grad` | `linear-gradient(135deg,#C9A200,#FFD700)` | `linear-gradient(135deg,#D4AF37,#FFD700)` |
| contact.html | L15 | `--gold` | `#C9A200` | `#D4AF37` |
| contact.html | L18 | `--grad` | `linear-gradient(135deg,#FFB300,#FFD700)` | `linear-gradient(135deg,#D4AF37,#FFD700)` |

**Fix:** Replace all `#C9A200` → `#D4AF37` in HTML inline styles.

---

### 🔴 CRITICAL-03: Old Gold rgba `rgba(201,162,0,...)` and `rgba(201,169,98,...)`

**Impact:** ~75 occurrences. Every glow, shadow, border uses wrong gold.

**rgba(201,162,0,...) — in HTML inline styles:**
| File | Approx Count |
|------|--------------|
| index.html | ~25 |
| menu.html | ~17 |
| contact.html | ~2 |
| checkout.html | ~3 |
| loyalty.html | ~8 |
| table-reservation.html | ~10 |
| kds.html | ~1 |
| brand-guideline.html | ~4 |
| **Total HTML** | **~70** |

**rgba(201,169,98,...) — #C9A84C equivalent:**
| File | Lines |
|------|-------|
| checkout.html | L322 |
| success.html | L130,137,163,211,268,539 |

**In CSS files:**
| File | Count |
|------|-------|
| styles.css | L212,213,215,613 |
| premium-upgrade.css | L21,27,40,41,42,78,115,135,142,143,202,229 (15 occurrences) |

**Fix:** Replace all `rgba(201,162,0,` → `rgba(212,175,55,` and `rgba(201,169,98,` → `rgba(212,175,55,`

---

### 🔴 CRITICAL-04: Old Gold Hex `#C9A962` and `#B8941F`

**Impact:** 5 CSS files use wrong gold shades.

| File | Lines | Current | Should |
|------|-------|---------|--------|
| styles.css | L19,53,212,213,613,2032 | `#C9A962` | `#D4AF37` |
| ui-enhancements.css | L158,168,201,202,212 | `#C9A962` | `#D4AF37` |
| checkout-styles.css | L488,496 | `#C9A962` | `#D4AF37` |
| premium-upgrade.css | L201,212 | `#C9A962` | `#D4AF37` |
| print-receipt.css | L12 | `#C9A962` | `#D4AF37` |

| File | Lines | Current | Should |
|------|-------|---------|--------|
| ui-enhancements.css | L158 | `#B8941F` | `#B8860B` |
| checkout-styles.css | L488 | `#B8941F` | `#B8860B` |

**Fix:** Replace `#C9A962` → `#D4AF37` and `#B8941F` → `#B8860B`.

---

### 🟡 HIGH-01: Old Background Colors (`#0A0A0A`, `#1A1A1A`)

**Impact:** Pages use dark gray-black bg instead of brand Navy.

| Current | Brand Token | Occurrences |
|---------|-------------|-------------|
| `#0A0A0A` | `#1A1A2E` (var(--bg)) | ~15 across HTML+CSS |
| `#0A0F1F` | `#1A1A2E` | 4 HTML pages |
| `#1A1A1A` | `#151A28` (var(--section)) | ~5 |
| `#111111` | `#151A28` | styles.css |
| `#0F0F0F` | `#151A28` | styles.css |
| `#141414` | `#202640` | styles.css |

---

### 🟡 HIGH-02: Old Text Body Color `#9E9E9E`

**Impact:** 5 HTML pages use dimmer gray than brand spec.

| File | Lines | Current | Should |
|------|-------|---------|--------|
| index.html | L28 | `#9E9E9E` | `#B0B0B0` |
| menu.html | L17 | `#9E9E9E` | `#B0B0B0` |
| contact.html | L17 | `#9E9E9E` | `#B0B0B0` |
| checkout.html | L17 | `#9E9E9E` | `#B0B0B0` |
| loyalty.html | L25 | `#9E9E9E` | `#B0B0B0` |

---

### 🟡 HIGH-03: No CSS File Imports brand-tokens.css

**Impact:** All 9 CSS files define their own `:root` tokens or hardcode values. Brand tokens exist but are never referenced.

| CSS File | Has own `:root`? | Diverges from brand tokens? |
|----------|-------------------|-----------------------------|
| styles.css | ✅ Yes (L4, L1099) | ✅ M3 coffee theme |
| ui-enhancements.css | ❌ No | ✅ Hardcodes `#C9A962`, `#0A0A0A` |
| about-m3.css | ✅ Yes (L7) | ✅ Completely M3 purple |
| premium-upgrade.css | ❌ No | ✅ Heaviest old-gold violator |
| checkout-styles.css | ❌ No | ✅ `#C9A962`, `#B8941F` |
| track-order-styles.css | ❌ No | ✅ Tailwind status colors |
| kds-m3.css | ✅ Yes (L7) | ✅ Completely M3 purple |
| kds-styles.css | ✅ Yes (L6) | ✅ Own KDS slate palette |
| print-receipt.css | ✅ Yes (L9) | ✅ Coffee theme |

**Fix:** Remove local `:root` overrides. Import `brand-tokens.css` as single source of truth.

---

### 🟡 HIGH-04: Miscellaneous Hardcoded Colors

| Color | Current | Found In | Should |
|-------|---------|----------|--------|
| `#FF6B35` | Orange | index.html L328 | Not in tokens — flag |
| `#FFB300` | Amber | menu, contact `--amber` | `#FFB380` (var(--amber)) |
| `#00BCD4` | Cyan | contact `--cyan` | Not in tokens — use `var(--aura-info)` |
| `#4CAF50` | Green | multiple | `var(--aura-success)` |
| `#FF5252`/`#EF4444` | Red | multiple | `var(--aura-danger)` |
| `#78909C` | Gray badge | menu.html | Not in tokens |
| `#AB47BC` | Purple badge | menu.html | Not in tokens |
| `#5C6BC0` | Indigo badge | menu.html | Not in tokens |

---

### 🟠 MEDIUM-01: Font Violations

| Issue | Files | Current | Should |
|-------|-------|---------|--------|
| Space Grotesk | about-us.html, success.html | `'Space Grotesk'` | `'Manrope'` or `'Inter'` |
| Cormorant Garamond | about-us.html, success.html | `'Cormorant Garamond'` | `'Playfair Display'` |
| Missing Manrope | Most HTML pages | font stack skips Manrope | Add `Manrope` before `Inter` |

Brand token `--aura-font-body: 'Manrope', 'Inter', system-ui, sans-serif`

---

### 🟠 MEDIUM-02: Divergent Design Systems

| System | Files | Issue |
|--------|-------|-------|
| M3 Purple | about-m3.css, kds-m3.css | Material 3 purple theme — completely different from Noir/Gold |
| KDS Slate | kds-styles.css | Tailwind slate palette — not brand-aligned |
| Coffee | styles.css, print-receipt.css | Coffee brown accent — not brand Gold |
| Silver | checkout, loyalty, table-reservation, kds, success | Silver (#C0C0C0) theme — should be Gold |

---

## Automated Fix Priority

### Phase 1 — Global Search & Replace (P0)

```bash
# 1. Fix silver-as-gold in HTML
sed -i '' 's/#C0C0C0/#D4AF37/g' checkout.html loyalty.html table-reservation.html kds.html success.html
sed -i '' 's/#E0E0E0/#FFD700/g' checkout.html loyalty.html table-reservation.html kds.html success.html

# 2. Fix old gold #C9A200 in HTML
sed -i '' 's/#C9A200/#D4AF37/g' index.html menu.html contact.html

# 3. Fix old gold rgba in HTML+CSS
find . -name "*.html" -o -name "*.css" | xargs sed -i '' 's/rgba(201,162,0,/rgba(212,175,55,/g'
find . -name "*.html" -o -name "*.css" | xargs sed -i '' 's/rgba(201,169,98,/rgba(212,175,55,/g'

# 4. Fix old gold hex in CSS
sed -i '' 's/#C9A962/#D4AF37/g' css/*.css
sed -i '' 's/#B8941F/#B8860B/g' css/*.css

# 5. Fix old backgrounds
find . -name "*.html" | xargs sed -i '' 's/#0A0A0A/#1A1A2E/g'
find . -name "*.html" | xargs sed -i '' 's/#1A1A1A/#151A28/g'
find . -name "*.html" | xargs sed -i '' 's/#0A0F1F/#1A1A2E/g'

# 6. Fix old text body
find . -name "*.html" | xargs sed -i '' 's/#9E9E9E/#B0B0B0/g'
```

### Phase 2 — Remove Local `:root` Overrides (P1)

Remove `<style>` block `:root` sections from all 8 HTML pages that override brand tokens. Use `brand-tokens.css` as single source.

### Phase 3 — M3 Divergence (P2)

Refactor `about-m3.css` and `kds-m3.css` to use Noir/Gold brand tokens instead of M3 purple.

---

*Report generated by Mekong CLI / CSS Lint Pipeline*