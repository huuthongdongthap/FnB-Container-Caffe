# Handoff Report — Explorer 2 (Bazi Aura Cafe UI Audit)

This handoff report summarizes the comprehensive audit of the active `FnB-Container-Caffe` codebase, detailing occurrences of banned colors, banned fonts, and previous partner references, as well as the verification of `css/brand-tokens.css` linking status.

---

## 1. Observation
Exhaustive scans were performed across all active `.html`, `.css`, and `.js` files using targeted local grep searches. Below are direct observations of violations and layout states:

### Banned Color Elements:
*   **Gold/Earth Tones:**
    *   `admin/launch-monitor.html` (line 83): `border: 1px solid #FFD700;`
    *   `admin/loyalty-dashboard.html` (line 14): `color: #D4AF37;` and (line 255): `borderColor: '#D4AF37'`
    *   `data/loyalty-config.json` (line 53): `"card_background_color": "#B8860B"`
    *   `designs/leaflet-a5.html` (line 447): `background: linear-gradient(135deg, #FFD700, #B8860B);`
*   **Red/Orange/Fire Tones:**
    *   `admin/dashboard.html` (line 15): `--orange:#FF6B35;` and (line 230): `stroke="#FF6B35"`, (line 237): `background:#FF6B35`
    *   `admin/reservations.html` (line 14): `--orange:#FF6B35;`
    *   `menu.html` (line 16): `--orange:#FF6B35;`
    *   `promotions.html` (line 168): `background-color: #FF6B35;`
    *   `failure.html` (line 247): `stroke: #FF1744;` and (line 267): `background-color: #FF1744;`
*   **Earthy Browns:**
    *   `data/loyalty-config.json` (line 14): `"tier_badge_color": "#8B4513"`

### Banned Fonts:
*   **`Playfair Display`:**
    *   `css/hero-aura.css` (line 16): `--font-display: 'Playfair Display', serif;`
*   **`Inter`:**
    *   `css/brand-tokens.css` (line 65): `--aura-font-body: 'Space Grotesk', 'Inter', system-ui, -apple-system, sans-serif;`
    *   `css/hero-aura.css` (line 17): `--font-body: 'Inter', sans-serif;`
    *   `admin/dashboard.html` (line 18): `--fb: 'Inter', -apple-system, sans-serif;`

### 'Minh Tu' / 'Tú' Owner References:
*   `css/brand-tokens.css` (line 40): `/* 乙 MỘC — Bar zone (decouple khỏi Tú, dùng cho hóa giải hướng Nam + nhân sự Hỏa) */`
*   `designs/pencil-bazi-adjustment-prompts.md` (lines 32, 37, 79, 89, 130, 146, 164, 167): E.g. `Section "乙 MỘC — PHA CHẾ TÚ"`, `"Bar Tú"`, `"rút năng lượng Tú"`, etc.
*   `tools/bazi-mcp/report-nguyen-minh-tu.html`: Entire report.

### CSS Link Tags for `css/brand-tokens.css`:
*   Correctly linked in all 12 core HTML pages: `index.html` (line 16 & 22), `menu.html` (line 10), `checkout.html` (line 10), `success.html` (line 77), `failure.html` (line 77), `loyalty.html` (line 13), `track-order.html` (line 64), `kds.html` (line 11), `table-reservation.html` (line 10), `about-us.html` (line 34), `contact.html` (line 10), and `brand-guideline.html` (line 10).

---

## 2. Logic Chain
1. **Color Audit:** The direct matches for Gold, Red, Orange, and Earthy Brown hex codes prove that banned elements are still hardcoded in active layouts, dashboards, and config files (e.g. `menu.html`, `failure.html`, `data/loyalty-config.json`). Since Bazi specs state these clash with the owner's Water (壬 Thủy) energy, they must be systematically migrated to Chrome/Silver or neutral variables.
2. **Typography Audit:** The font `Playfair Display` is hardcoded in `css/hero-aura.css` rather than using the token `--aura-font-display` (Cormorant Garamond). In addition, `Inter` is imported/referenced in `brand-tokens.css` and `hero-aura.css` despite being banned. Replacing these with `var(--aura-font-display)` and `var(--aura-font-body)` will align the active typography perfectly with Bazi v5.0.
3. **Decoupling Audit:** Stand-alone references to the previous owner "Tú" are present in the core stylesheet comments (`css/brand-tokens.css` line 40) and design prompts. Modifying the stylesheet comment will achieve complete code-level decoupling of Nguyễn Minh Tú.
4. **Link Tag Verification:** Every core HTML file has successfully integrated the `css/brand-tokens.css` single source of truth, establishing a solid baseline for subsequent premium UI overhauls.

---

## 3. Caveats
*   Legacy files in `_deploy/` and `_archive/` still contain banned colors/fonts and owner references; these were ignored as they are not part of the active codebase source files.
*   The admin panel dashboard, staff, and pos tools utilize their own distinct embedded `<style>` sheets instead of referencing `css/brand-tokens.css`, which is acceptable but needs care when applying global color changes.

---

## 4. Conclusion
The codebase is structured correctly with `css/brand-tokens.css` serving as the main stylesheet across all 12 user-facing HTML pages. However, several hardcoded banned colors, fonts, and owner references must be replaced before proceeding to Milestone 3 (Premium UI Overhaul).

---

## 5. Verification Method
Verify that the banned colors and fonts are cleared using targeted ripgrep searches:
1.  **Check colors:**
    `grep -rnI "#FFD700\|#D4AF37\|#B8860B\|#FFE970\|#FF6B35\|#FF1744\|#8B4513\|#C9A200\|#C9A962" *.html admin/*.html css/*.css data/*.json` (should return 0 matches after the fix).
2.  **Check fonts:**
    `grep -rnI "Playfair\|Cinzel\|Manrope" *.html css/*.css` (should return 0 matches after the fix).
3.  **Check decoupling:**
    `grep -rnwi "Tú" css/brand-tokens.css` (should return 0 matches after the fix).
4.  **Local preview:**
    Open `index.html` or `brand-guideline.html` locally to ensure no layout or font rendering breaks.
