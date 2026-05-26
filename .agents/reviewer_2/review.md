# Bazi-aligned Aura Cafe UI Overhaul — Independent Review Report

## Review Summary

**Verdict**: REQUEST_CHANGES

We have conducted a thorough, independent review and stress-test of the Bazi-aligned Aura Cafe UI Overhaul (Sprint Bazi v5.1). While the core color system (Silver/Chrome/Steel) and glassmorphism styling are highly premium and correct in 11 of the 12 public templates, we have identified lingering "Gold" (vàng) design terminology and styling mismatches in `brand-guideline.html`. 

As a result, Bazi element alignment is not yet 100% complete in the documentation and brand book. A transition to REQUEST_CHANGES is required to finalize these final gaps.

---

## Findings

### [Major] Finding 1: Residual Banned "Gold" (Vàng) Terminology in active Brand Book
- **What**: Numerous occurrences of "vàng", "vàng đồng", and "vàng kim" are still present in active style descriptions.
- **Where**: `/Users/mac/mekong-cli/FnB-Container-Caffe/brand-guideline.html`
  - Line 492: `"...nơi gặp gỡ giữa ánh vàng kim,"`
  - Line 571: `"Noir Lounge 水 Thủy — nền đen sâu + vàng kim loại sang trọng."`
  - Line 681: `"...kính trong mỏng viền vàng."`
  - Line 702: `"Sỏi trắng-vàng rải trên nền..."`
  - Line 760: `"Giữ nền đen sâu (#1A1A2E), accent vàng (#C9D6DF)."` (Note: `#C9D6DF` is actually Chrome Silver, but the label still says "vàng").
  - Line 794: `"Bao bì mang theo ngôn ngữ Noir Lounge: kraft đen, in foil vàng..."`
  - Line 813: `"Túi giấy kraft đen 150gsm, quai cotton vàng đồng thắt nút..."`
  - Line 825: `"Khăn giấy đen in emblem vàng foil..."`
  - Line 842: `"Đồng phục phối sáng công nghiệp + chi tiết kim loại ấm. Tông chủ đạo: đen + đồng vàng."`
  - Line 843: `"Mỗi nhân viên có pin cài logo vàng + name tag..."`
  - Line 874: `"...senior dùng vàng đồng."`
- **Why**: Requirement R2 explicitly mandates renaming all "Gold" terminology and labels in `brand-guideline.html` to Chrome/Silver/Steel. Leaving these references actively representing the brand contradicts the Bazi Thủy-Kim alignment (where Thổ/Gold is forbidden).
- **Suggestion**: Rename these references to "bạc", "chrome", "bạc kim", or "thép" to match the updated visual system (e.g., change "foil vàng" to "foil bạc", "quai cotton vàng đồng" to "quai cotton thép/chrome", etc.).

### [Minor] Finding 2: Font Preload Placement Mismatch in brand-guideline.html
- **What**: The stylesheet link `<link rel="stylesheet" href="css/brand-tokens.css">` is placed *before* the font preconnect/preload tags.
- **Where**: `/Users/mac/mekong-cli/FnB-Container-Caffe/brand-guideline.html` (Lines 10-22).
- **Why**: Requirement R1 mandates that preloads are placed before any CSS stylesheets to eliminate layout shifts (FOUT). Placing the stylesheet before the preloads defeats the optimization benefit.
- **Suggestion**: Re-order the elements in `<head>` so that all preconnect and preload tags appear before any stylesheet link.

---

## Verified Claims

- **Inter Fallback & Banned Typography Purged** → **PASSED**
  - Verified that `--aura-font-body` in `css/brand-tokens.css` is completely clean of the banned `Inter` fallback and mapped to `'Space Grotesk'`.
  - Verified that the banned fonts (`Playfair Display`, `Cinzel`, `Manrope`) have been completely replaced with `'Cormorant Garamond'` and `'Space Grotesk'`.

- **Banned Color Hexes Cleaned in Production** → **PASSED**
  - Verified that no hardcoded instances of gold (`#FFD700`, `#D4AF37`, `#B8860B`), red (`#FF1744`), or orange (`#FF6B35`) exist in the active stylesheets (`css/brand-tokens.css`, `css/hero-aura.css`, etc.) or core customer-facing templates.

- **Admin Color Cleanliness** → **PASSED**
  - Verified that `/admin/launch-monitor.html` and `/admin/loyalty-dashboard.html` have been successfully updated to comply with v5.1 rules (e.g. tier colors updated to `#C9D6DF`).

- **Minh Tú / Tú Decoupling** → **PASSED**
  - Checked that all comments, markup, and metadata references to "Minh Tú" or "Tú" have been successfully expunged from the active directory.

- **Water Ripple & Premium Glassmorphism** → **PASSED**
  - Checked that high-fidelity backdrop-filters are present across core sheets (`ui-polish-v5.css`, etc.) and the interactive water ripple code is correctly structured in `js/hero-v8-bazi.js`.

---

## Coverage Gaps

- **No Gaps Identified**: The entire target set of stylesheets, templates, JSON configurations, and documentation files were audited recursively.

---

## Unverified Items

- **Runtime Test Execution**: The shell command execution for `npm test` could not be executed due to strict system permission restrictions in this sandbox.
  - *Mitigation*: The test files (`tests/*.test.js`) were statically reviewed. They contain authentic, rigorous DOM and layout assertions and are validated to be free of dummy mocks or hardcoded test bypasses.

---

# Adversarial Challenge Report

## Challenge Summary

**Overall risk assessment**: LOW

The structural foundations of the v5.1 theme are highly robust. By utilizing compatible CSS variables mapping in `css/brand-tokens.css`, legacy layouts are preserved from rendering crashes while mapping to the new Thủy-Kim metallic palette.

---

## Challenges

### [Low] Challenge 1: Silent Layout Shifts on Font Timeout
- **Assumption challenged**: Space Grotesk and Cormorant Garamond will always load instantaneously.
- **Attack scenario**: Under poor mobile bandwidth at the Sa Đéc container cafe site, Google Fonts requests may experience delay.
- **Blast radius**: The pages fallback to system sans-serif/serif. Due to minor character width differences, this could cause slight container overflows in high-density components (like loyalty balance cards).
- **Mitigation**: Add a `font-display: swap;` directive to the font definitions inside the styles to ensure an elegant fallback transition.

### [Low] Challenge 2: Head Placement Consistency
- **Assumption challenged**: The layout engine of mobile browsers handles stylesheet parsing smoothly regardless of ordering.
- **Attack scenario**: In older mobile WebKit browsers, having a CSS link before preloads (as seen in `brand-guideline.html`) causes the browser to block layout rendering, rendering the preloads redundant.
- **Blast radius**: Unnecessary layout shift (FOUT) on the brand guideline view.
- **Mitigation**: Fix the ordering in `brand-guideline.html` so that preloads always precede stylesheet declarations.

---

## Stress Test Results

- **Bazi Element Alignment** → **PARTIAL** (Functional code passes, but the brand documentation still explicitly references banned "vàng" terms).
- **Decoupling Integrity** → **PASS** (Zero active references to Tú/Minh Tú remain).
- **Compatibility Fallbacks** → **PASS** (Legacy variables safely direct to the new Chrome/Steel theme).
