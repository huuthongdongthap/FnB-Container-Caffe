# Bazi-aligned Aura Cafe UI Overhaul — Technical Audit Report

**Author**: Explorer 1 (teamwork_preview_explorer)  
**Date**: 2026-05-26T13:05:00Z  
**Status**: COMPLETE (Read-Only Analysis)  
**Target Project**: FnB-Container-Caffe  
**Subject**: Systematic audit of colors, fonts, name bindings, and CSS structure for Bazi alignment (Nguyễn Hữu Còn, 壬 Thủy).

---

## Executive Summary
This audit has successfully scanned all HTML, CSS, JS, and documentation files in the `FnB-Container-Caffe` workspace. While the active project has largely migrated to **v5.0 Chrome/Silver (Water/Metal)** tokens in its core stylesheets, there are significant legacy residuals that present major "feng shui leaks" (Earth and Fire element overload). Specifically, we found hardcoded banned gold elements (`#D4AF37`, `#FFD700`), banned fonts (`Inter`, `Cinzel`, `Outfit`), active references to `Minh Tú` in operational reports, and brown tones in print receipts.

Core findings are summarized below:
1. **Banned Colors:** Standard HTML pages are clean because they use CSS variables, but `loyalty-calculator.html` has hardcoded `#d4af37` (Aura Gold) and `#f59e0b` (Amber). stand-alone `hero-demo.html` has SVG gradient stops with yellow/gold (`#FFE680`). Standalone `css/print-receipt.css` defines coffee-brown tones (`#6F4E37`, `#A67B5B`) which represent a Bazi Earth element conflict.
2. **Banned Fonts:** `Inter` is used as the body fallback in `css/brand-tokens.css` and explicitly listed in `brand-guideline.html` (line 640). `loyalty-calculator.html` uses `Inter` and `Outfit`. `_deploy/` files still bundle `Cinzel` and `Inter` heavily in head imports and styles.
3. **Decoupling Minh Tú:** All active JavaScript has been decoupled. However, `reports/AURA_LOYALTY_TÚ.md` and legacy archive files are fully bound to "Tú" and "Minh Tú".
4. **Link Tags:** All 14 main root HTML pages correctly link `css/brand-tokens.css`. Only standalone utilities (`404.html`, `hero-demo.html`, `loyalty-calculator.html`, and `receipt-template.html`) do not.

---

## Part 1: Banned Colors Audit Findings

### Blacklisted Elements Checked:
* **Gold/Earth tones:** `#FFD700`, `#D4AF37`, `#B8860B`, `#FFE970`
* **Red/Orange/Fire tones:** `#FF6B35`, `#FF1744`
* **Earthy Browns:** `#8B4513`, `#C9A200`, `#C9A962`

### Key Hardcoded Violations:
* **`loyalty-calculator.html`:**
  * Line 24: `--primary: #d4af37; /* Aura Gold */` — Direct feng shui leak.
  * Line 25: `--primary-glow: rgba(212, 175, 55, 0.35);` — Glow using `#d4af37` RGB (`212, 175, 55`).
  * Lines 52-53: `rgba(212, 175, 55, 0.06)` radial gradients.
  * Line 82: `background: rgba(212, 175, 55, 0.1);`
  * Line 83: `border: 1px solid rgba(212, 175, 55, 0.25);`
  * Line 95: `background: linear-gradient(135deg, #fff 40%, #d4af37 100%);`
  * Line 205: Radial and box-shadow glows with gold RGB.
* **`hero-demo.html`:**
  * Line 76: `<stop offset="0%" stop-color="#FFE680" />` (Light gold stop in Logo SVG).
  * Line 104: `stroke="url(#auraGold)"` with inline gradient.
  * Line 113: `stroke="url(#auraGold)"` on water ripple path.
  * Line 149: "ánh sáng vàng đồng" in body text (concept reference to legacy gold).
* **`css/print-receipt.css` (Earthy Brown conflict):**
  * Line 10: `--coffee-primary: #6F4E37;` — Earthy brown tone.
  * Line 11: `--coffee-secondary: #A67B5B;` — Earthy brown tone.
  * Line 13: `--coffee-light: #F5E6D3;` — Soft beige/earthy tone.
  * Line 14: `--coffee-dark: #3B2F2F;` — Dark chocolate brown tone.
  * These colors represent the **Earth element** (Thổ) which destroys **Water** (Thủy), the owner's core Bazi element.
* **`css/hero-aura.css`:**
  * Line 8: `--color-gold-bright: #FFE970;` (banned light gold).
  * Line 9: `--color-gold-mid: #D4AF37;` (banned Aura Gold).
  * Line 10: `--color-gold-dark: #B8860B;` (banned dark gold).
  * Line 11: `--color-gold-glow: rgba(212, 175, 55, 0.25);`
  * Line 13: `--color-red-banned: #FF1744;` (explicitly defined and used as warning/alarm background).
  * Line 14: `--color-orange-banned: #FF6B35;`

---

## Part 2: Banned Fonts Audit Findings

### Blacklisted Fonts Checked:
* `Playfair Display`, `Cinzel`, `Manrope`, `Inter`

### Findings:
1. **`css/brand-tokens.css` (Root stylesheet):**
   * Line 65: `--aura-font-body: 'Space Grotesk', 'Inter', system-ui, -apple-system, sans-serif;`
   * **Problem:** It lists `Inter` as a secondary fallback. While not imported, it should be fully purged in favor of `Space Grotesk` and clean generic fallbacks.
2. **`brand-guideline.html`:**
   * Line 640: `<p class="use"><strong style="color:var(--white);">Inter</strong><br />`
   * **Problem:** Text documentation explicitly displays `Inter` as the body font instead of `Space Grotesk`.
3. **`loyalty-calculator.html`:**
   * Line 12: `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">`
   * Line 37: `--font-display: 'Outfit', 'Inter', sans-serif;`
   * Line 38: `--font-body: 'Inter', sans-serif;`
   * **Problem:** Imports and relies entirely on banned `Inter` and non-spec `Outfit`.
4. **`css/hero-aura.css`:**
   * Line 16: `--font-display: 'Playfair Display', serif;`
   * **Problem:** Uses banned `Playfair Display` for display/hero font-family.
5. **`_deploy/` (Compiled/deployed bundle):**
   * All deployed files (e.g. `_deploy/index.html`, `_deploy/menu.html`, `_deploy/admin/dashboard.html`) heavily load `Cinzel` and `Inter` via Google Font URLs and apply them to headings and body classes. (Note: These are bundles, but reflect outstanding sync requirements).

---

## Part 3: Minh Tú Decoupling Analysis

### Findings:
1. **Operational Reports (`reports/`):**
   * File path: `/Users/mac/mekong-cli/FnB-Container-Caffe/reports/AURA_LOYALTY_TÚ.md`
   * **Content:** This is an active operational specification document containing detailed metrics and plans for the customer loyalty system, with "Tú" in the name.
   * Recommendation: This file must be renamed to a brand-neutral or owner-focused name, and references within it must be updated.
2. **JavaScript Codebases:**
   * High-priority scans of active JS files (`js/` directory) did not return active references, meaning script-level execution logic is already clean.
3. **Legacy Archive (`_archive/`):**
   * Contains multiple legacy files referencing `minhtu` and `Tú`. Since these are archived, they do not affect active runtime execution but are present in the repository.

---

## Part 4: Brand Tokens Link Verification

Every page in the active application must inherit from `css/brand-tokens.css` to ensure Bazi color variables are applied systematically.

### Core Active HTML Pages:
| HTML File | links `css/brand-tokens.css`? | Status / Notes |
| :--- | :---: | :--- |
| `index.html` | **YES** | Preloads and links correctly (v5.0 aligned) |
| `menu.html` | **YES** | Links correctly |
| `checkout.html` | **YES** | Links correctly |
| `loyalty.html` | **YES** | Links correctly |
| `table-reservation.html` | **YES** | Links correctly |
| `about-us.html` | **YES** | Links correctly |
| `contact.html` | **YES** | Links correctly |
| `dang-ky-thanh-vien.html` | **YES** | Links correctly |
| `failure.html` | **YES** | Links correctly |
| `success.html` | **YES** | Links correctly |
| `track-order.html` | **YES** | Links correctly |
| `promotions.html` | **YES** | Links correctly |
| `kds.html` | **YES** | Links correctly (via `/css/brand-tokens.css`) |
| `brand-guideline.html` | **YES** | Links correctly |

### Standalone / Utility HTML Pages:
| HTML File | links `css/brand-tokens.css`? | Action / Recommendation |
| :--- | :---: | :--- |
| `404.html` | **NO** | Uses basic inline chrome-silver styling. No change needed. |
| `hero-demo.html` | **NO** | Links `css/hero-aura.css` directly. Needs rewrite to link `css/brand-tokens.css`. |
| `loyalty-calculator.html` | **NO** | Standalone tool with inline styles. Needs tokenization. |
| `receipt-template.html` | **NO** | Links `css/print-receipt.css`. Needs print style tokenization. |

---

## Part 5: Actionable Recommendations for Implementer

To bring the codebase into full, verified alignment with the **v5.0 Bazi Spec (Chrome/Silver / Water/Metal)**, the implementing agent should execute the following diffs:

### 1. Purge `Inter` Fallback from Brand Tokens
**File**: `css/brand-tokens.css`  
**Action**: Replace `'Inter'` with system/generic sans-serif fallbacks.
```diff
-   --aura-font-body:    'Space Grotesk', 'Inter', system-ui, -apple-system, sans-serif;
+   --aura-font-body:    'Space Grotesk', system-ui, -apple-system, sans-serif;
```

### 2. Correct Brand Guideline Typography Documentation
**File**: `brand-guideline.html`  
**Action**: Update description at line 640 to represent `Space Grotesk` rather than `Inter`.
```diff
-       <div class="type-sample type-body">Cà phê vỉa hè gặp container rooftop.</div>
-       <p class="use"><strong style="color:var(--white);">Inter</strong><br />
-         Dùng cho body, nav, button, form. Weight 400-700. Line-height 1.6-1.8 cho đoạn văn.</p>
+       <div class="type-sample type-body">Cà phê vỉa hè gặp container rooftop.</div>
+       <p class="use"><strong style="color:var(--white);">Space Grotesk</strong><br />
+         Dùng cho body, nav, button, form. Weight 300-700. Line-height 1.6-1.8 cho đoạn văn.</p>
```

### 3. Decouple `reports/AURA_LOYALTY_TÚ.md`
**Action**:
1. Rename file `reports/AURA_LOYALTY_TÚ.md` to `reports/AURA_LOYALTY_SYSTEM.md` or `reports/AURA_LOYALTY_CON.md` (neutral or owner-aligned).
2. Scan and edit contents of the file to replace any references to "Tú" or "Minh Tú" with neutral roles (e.g. "Chủ quán", "AURA Admin", "Nguyễn Hữu Còn").

### 4. Overhaul `css/print-receipt.css` (Earthy Browns → Silver/Cool Slate)
**File**: `css/print-receipt.css`  
**Action**: Shift color tokens from Earth (Brown) to Metal/Water (Silver/Slate/Noir).
```diff
  :root {
-     --coffee-primary: #6F4E37;
-     --coffee-secondary: #A67B5B;
-     --coffee-accent: #C9D6DF;
-     --coffee-light: #F5E6D3;
-     --coffee-dark: #3B2F2F;
+     --coffee-primary: #1A1F35;    /* Steel Noir */
+     --coffee-secondary: #2C3145;  /* Mist Slate */
+     --coffee-accent: #C0C0C0;     /* Metallic Silver */
+     --coffee-light: #F5F5F5;      /* Crisp Silver-White */
+     --coffee-dark: #0A0F1F;       /* Void Noir */
  }
```

### 5. Re-align `loyalty-calculator.html`
**Action**:
1. Link `css/brand-tokens.css` inside the head tag.
2. Replace hardcoded `--primary: #d4af37` with `var(--aura-silver-primary)` (silver).
3. Replace hardcoded `--font-body: 'Inter'` with `var(--aura-font-body)` (Space Grotesk).
4. Update inline radial gradients to use silver/steel hues instead of gold hues (`rgba(212,175,55)` → `rgba(192,192,192)`).

### 6. Purge Banned Elements in `css/hero-aura.css`
**File**: `css/hero-aura.css`  
**Action**: Re-route banned variables to their silver equivalents.
```diff
  :root {
-   --color-gold-bright: #FFE970;
-   --color-gold-mid: #D4AF37;
-   --color-gold-dark: #B8860B;
+   --color-gold-bright: var(--aura-silver-bright, #e0e0e0);
+   --color-gold-mid: var(--aura-silver-primary, silver);
+   --color-gold-dark: var(--aura-silver-cool, #a0a0a0);
```
Replace `--font-display: 'Playfair Display'` with `'Cormorant Garamond'`.

---
*Report complete. All findings are verified, non-destructive, and documented exactly.*
