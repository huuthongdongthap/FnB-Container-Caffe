# Handoff Report — Explorer 1 (teamwork_preview_explorer)

**Subject**: Handoff for Bazi-aligned Aura Cafe UI Overhaul  
**Target Folder**: /Users/mac/mekong-cli/FnB-Container-Caffe/.agents/explorer_1/  
**Milestone**: Bazi-aligned Aura Cafe UI Overhaul  
**Autonomy level**: L0 (Read-only Analysis)

---

## 1. Observation
Below are direct observations gathered through systematic ripgrep and file-viewing tools within the `/Users/mac/mekong-cli/FnB-Container-Caffe` workspace:

### 1.1 Banned Colors (Fire & Earth elements)
* **`css/print-receipt.css` (lines 10-14):**
  ```css
  --coffee-primary: #6F4E37;
  --coffee-secondary: #A67B5B;
  --coffee-light: #F5E6D3;
  --coffee-dark: #3B2F2F;
  ```
  These brown coffee/earth tones represent Earth (Thổ) elements, which destroy the owner's element Water (Thủy).
* **`loyalty-calculator.html` (line 24, 25, 95):**
  ```html
  --primary: #d4af37; /* Aura Gold */
  --primary-glow: rgba(212, 175, 55, 0.35);
  background: linear-gradient(135deg, #fff 40%, #d4af37 100%);
  ```
  Direct use of banned Gold (`#d4af37`).
* **`hero-demo.html` (line 76, 104, 113):**
  ```html
  <stop offset="0%" stop-color="#FFE680" />
  stroke="url(#auraGold)"
  ```
  Includes light yellow/gold inline gradient stops in Logo and ripple SVGs.
* **`css/hero-aura.css` (lines 8-10, 13-14):**
  ```css
  --color-gold-bright: #FFE970;
  --color-gold-mid: #D4AF37;
  --color-gold-dark: #B8860B;
  --color-red-banned: #FF1744;
  --color-orange-banned: #FF6B35;
  ```
  Defines banned gold, red, and orange variables.

### 1.2 Banned Fonts
* **`css/brand-tokens.css` (line 65):**
  ```css
  --aura-font-body:    'Space Grotesk', 'Inter', system-ui, -apple-system, sans-serif;
  ```
  Uses banned font `'Inter'` as a body fallback.
* **`brand-guideline.html` (lines 640-641):**
  ```html
  <p class="use"><strong style="color:var(--white);">Inter</strong><br />
            Dùng cho body, nav, button, form. Weight 400-700. Line-height 1.6-1.8 cho đoạn văn.</p>
  ```
  Explicitly documents `Inter` as the body font.
* **`loyalty-calculator.html` (lines 12, 37, 38):**
  ```html
  <link href="https://fonts.googleapis.com/css2?family=Inter:...family=Outfit:..." rel="stylesheet">
  --font-display: 'Outfit', 'Inter', sans-serif;
  --font-body: 'Inter', sans-serif;
  ```
  Imports and applies banned `Inter` and `Outfit` fonts.
* **`css/hero-aura.css` (line 16):**
  ```css
  --font-display: 'Playfair Display', serif;
  ```
  Uses banned display font `'Playfair Display'`.

### 1.3 Minh Tú / Tú Decoupling
* **`reports/` directory:**
  Direct finding: `/Users/mac/mekong-cli/FnB-Container-Caffe/reports/AURA_LOYALTY_TÚ.md` is an active operational markdown report.
* **`_archive/` directory:**
  Numerous legacy JS and text files in the `_archive/` directory contain references to `minhtu`, `minh_tu`, or `Tú`.

### 1.4 Link Tags
* **Verification command results:**
  All 14 active page-level HTML files at the root (e.g. `index.html`, `menu.html`, `checkout.html`, `loyalty.html`, `table-reservation.html`, `about-us.html`, `contact.html`, `dang-ky-thanh-vien.html`, `failure.html`, `success.html`, `track-order.html`, `promotions.html`, `kds.html`, `brand-guideline.html`) correctly link `css/brand-tokens.css`.
  Standalone utilities (`404.html`, `hero-demo.html`, `loyalty-calculator.html`, and `receipt-template.html`) do not link it.

---

## 2. Logic Chain
1. **Bazi Requirement:** The owner (Nguyễn Hữu Còn) has a **壬 Thủy (Yang Water)** Bazi profile. The design spec mandates **Water/Metal** elements (Chrome, Silver, White, Dark Slate) and strictly bans **Fire/Earth** elements (Gold, Red, Orange, Earthy Browns).
2. **Color Findings:** Since the active pages use `css/brand-tokens.css` which correctly defines Chrome/Silver variables, they are theoretically compliant. However, hardcoded violations in `loyalty-calculator.html` (`#d4af37`), `hero-demo.html` (`#FFE680`), and `css/print-receipt.css` (`#6F4E37`, `#A67B5B`) actively override these variables or introduce banned colors directly, creating severe element conflicts.
3. **Typography Findings:** Bazi spec mandates Cormorant Garamond, Space Grotesk, and JetBrains Mono. Fonts Playfair Display, Cinzel, Manrope, and Inter are strictly banned. The active inclusion of `Inter` as a secondary fallback in `css/brand-tokens.css`, the documentation in `brand-guideline.html`, and imports in `loyalty-calculator.html`/`css/hero-aura.css` violate this rule.
4. **Name Decoupling:** Decoupling mandates that the system operates neutrally or under the owner's name. Active JS files are clean, but `reports/AURA_LOYALTY_TÚ.md` represents an active binding of the loyalty program spec to the legacy name "Tú".
5. **System structure:** Since all primary pages correctly link `css/brand-tokens.css`, a central update to `brand-tokens.css` will propagates automatically. The other standalone utilities need specific corrections to use these variables.

---

## 3. Caveats
* **Archived Files:** We did not propose edits to the `_archive/` folder, as it represents inactive historical snapshots. The references to "Tú" there do not execute at runtime.
* **Compiled Bundles:** Deployed assets in `_deploy/` contain high concentrations of legacy code (e.g. `_deploy/assets/brand-tokens-BlcaUtqV.css` still contains older variables). The build pipeline should regenerate the `_deploy/` folder after active source files are corrected.

---

## 4. Conclusion
The codebase is structurally prepared for a complete Bazi-aligned transition because `css/brand-tokens.css` is widely and correctly linked across all 14 core HTML pages. However, several critical hardcoded color leaks, banned fonts, and named reports remain. To achieve 100% compliance:
1. Purge `'Inter'` from `css/brand-tokens.css` and `brand-guideline.html`.
2. Overhaul `css/print-receipt.css` to replace coffee-brown tones with silver-slate.
3. Update `loyalty-calculator.html` and `css/hero-aura.css` to inherit variables from `brand-tokens.css`.
4. Rename `reports/AURA_LOYALTY_TÚ.md` to `reports/AURA_LOYALTY_SYSTEM.md` and purge internal text references to Tú.

---

## 5. Verification Method
The next agent (Implementer) can verify the completeness of these recommendations using:
1. **Search command for banned colors:**
   ```bash
   grep -rnwi "FFD700\|D4AF37\|B8860B\|FFE970\|FF6B35\|FF1744\|8B4513\|C9A200\|C9A962\|6F4E37\|A67B5B" css/ *.html
   ```
   *Expected result: 0 matches (excluding `_archive/`).*
2. **Search command for banned fonts:**
   ```bash
   grep -rnwi "Playfair\|Cinzel\|Manrope\|Inter\|Outfit" css/ *.html
   ```
   *Expected result: 0 matches in root HTMLs and CSS sheets (except comments/placeholders).*
3. **Verify Minh Tú decoupling:**
   ```bash
   find reports/ -name "*TÚ*"
   grep -rnwi "Minh Tu\|Tú" reports/ js/
   ```
   *Expected result: 0 matches.*
4. **Project Test Run:**
   Run Pytest to ensure tool mappings are healthy:
   ```bash
   python3 -m pytest tests/
   ```

---
*Report compiled and handed over. Ready for implementation.*
