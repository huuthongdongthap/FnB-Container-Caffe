# UI Compliance and Bazi Alignment Analysis Report

**Prepared by:** Explorer 3 (teamwork_preview_explorer)  
**Workspace:** `FnB-Container-Caffe`  
**Status:** Complete  
**Last Updated:** 2026-05-26  

---

## Executive Summary
This comprehensive audit has scanned all active HTML files, CSS sheets, JavaScript scripts, and JSON configs in the `FnB-Container-Caffe` workspace. We have successfully verified compliance against the **Bazi v5.0 (Water/Metal - Silver/Chrome)** brand guidelines. While significant progress has been made to adopt premium silver/chrome tokens in active public-facing views, we have identified several precise "feng shui leaks" (legacy Fire/Earth elements, banned fonts, and outstanding name bindings) across layout variables, admin tools, and configuration files.

---

## 1. Forbidden Colors Audit

The Bazi v5.0 specification strictly prohibits **Gold/Earth** (Thổ khắc Thủy), **Red/Orange/Fire** (Hỏa hao Thủy), and **Earthy Browns** (Thổ) elements to maintain structural and energetic alignment.

### 1.1 Gold / Earth Tones
*   **Banned Codes:** `#FFD700`, `#D4AF37`, `#B8860B`, `#FFE970`
*   **Active Findings:**
    1.  **`admin/launch-monitor.html` (Line 83):** 
        ```css
        .tier-gold    { background:#2e2510; color:#FFD700; }
        ```
        *Impact:* Banned bright gold `#FFD700` is hardcoded as a tier badge font color.
    2.  **`admin/loyalty-dashboard.html` (Lines 14 & 255):**
        ```css
        Line 14:  --gold: #D4AF37;
        Line 255: const TIER_COLOR = { bronze: '#A5703F', silver: '#9CA8B5', gold: '#D4AF37', platinum: '#E8EEF3' };
        ```
        *Impact:* Legacy gold `#D4AF37` is hardcoded both as a CSS custom property and as a JS chart mapping color.
    3.  **`data/loyalty-config.json` (Line 53):**
        ```json
        "gradient": "linear-gradient(135deg, #FFD700 0%, #B8860B 100%)",
        ```
        *Impact:* The loyalty tier configuration contains hardcoded banned gold gradients (`#FFD700` and `#B8860B`) for the "Vàng" tier.
    4.  **`designs/leaflet-a5.html` (Line 447):**
        ```css
        .tier-vang  .badge-icon { background: linear-gradient(135deg, #F5E07C 0%, #B8860B 100%); }
        ```
        *Impact:* Uses matte gold `#B8860B` for decorative layout badges.

### 1.2 Red / Orange / Fire Tones
*   **Banned Codes:** `#FF6B35`, `#FF1744`
*   **Active Findings:**
    1.  **`menu.html` (Line 16, 97, 98, 104, 151):**
        ```css
        Line 16: --orange:#FF6B35;
        Line 98: box-shadow:0 0 16px rgba(255,107,53,.3)
        ```
        *Impact:* Active production template has a hardcoded orange element color variable `--orange` and applies explicit box shadows mapping to the banned orange color, creating a Fire element overload in the digital menu.
    2.  **`promotions.html` (Line 168):**
        ```css
        .promo-expiry { margin-top: 8px; font-size: 11px; color: #FF6B35; ... }
        ```
        *Impact:* Active promotional landing page uses banned orange color `#FF6B35` for expiry warning highlights.
    3.  **`admin/dashboard.html` (Lines 15, 230, 237):**
        ```css
        Line 15:  --gold:#C9D6DF;--gold-e:#E8EEF3;--amber:#FFB300;--orange:#FF6B35;
        Line 230: <circle cx="21" cy="21" r="15.9" fill="none" stroke="#FF6B35" stroke-width="4" ... />
        Line 237: <span class="legend-dot" style="background:#FF6B35"></span>
        ```
        *Impact:* The admin panel uses `#FF6B35` as an active category color for the orders chart (representing "Tại Quán").
    4.  **`admin/reservations.html` (Line 14):**
        ```css
        --orange:#FF6B35;
        ```
        *Impact:* Orange variable is hardcoded in root reservations styling.
    5.  **`failure.html` (Lines 247 & 267):**
        ```css
        Line 247: background: linear-gradient(135deg, var(--red-accent) 0%, #FF1744 100%);
        Line 267: background: linear-gradient(135deg, #ff5252 0%, #ff1744 100%);
        ```
        *Impact:* Banned neon red `#FF1744` is hardcoded as a gradient color stop on the active error page.

### 1.3 Earthy Browns
*   **Banned Codes:** `#8B4513`, `#C9A200`, `#C9A962`
*   **Active Findings:**
    1.  **`data/loyalty-config.json` (Line 14):**
        ```json
        "gradient": "linear-gradient(135deg, #CD7F32 0%, #8B4513 100%)"
        ```
        *Impact:* The "Đồng" loyalty tier configuration specifies a gradient containing banned earthy brown `#8B4513` (Thổ khắc Thủy).

---

## 2. Typography Audit (Banned Fonts)

Bazi v5.0 mandates using **Cormorant Garamond** (for display/headings), **Space Grotesk** (for body/labels), and **JetBrains Mono** (for tables/technical details). The fonts **Playfair Display**, **Cinzel**, **Manrope**, and **Inter** are strictly prohibited.

### 2.1 Playfair Display
*   **`css/hero-aura.css` (Line 16):**
    ```css
    --font-display: 'Playfair Display', serif;
    ```
    *Impact:* Active homepage hero stylesheet overrides standard branding fonts and loads the prohibited `Playfair Display`.

### 2.2 Inter
*   **`css/hero-aura.css` (Line 17):**
    ```css
    --font-body: 'Inter', sans-serif;
    ```
    *Impact:* The hero body copy utilizes the prohibited `Inter` font.
*   **`css/brand-tokens.css` (Line 65):**
    ```css
    --aura-font-body: 'Space Grotesk', 'Inter', system-ui, -apple-system, sans-serif;
    ```
    *Impact:* Banned font `Inter` is listed as a primary fallback variable in the global branding token.
*   **`admin/loyalty-dashboard.html` (Line 19):**
    ```css
    body { font-family: 'Inter', system-ui, sans-serif; ... }
    ```
    *Impact:* Admin dashboard is fully rendered using the banned font `Inter`.
*   **`promotions.html` (Line 19):**
    ```css
    body { font-family: 'Space Grotesk', 'Inter', sans-serif; }
    ```
    *Impact:* Promoted features fallback directly into `Inter` instead of standard fallbacks.

---

## 3. Owner Name Decoupling

To ensure completely professional and decoupled operational parameters, all references to the legacy owner (`Minh Tú` or `Tú`) must be decoupled, shifting the **Mộc Zone** to a natural feng shui balance (Wood absorbing excessive Fire).

### 3.1 Code-Level Comments
*   **`css/brand-tokens.css` (Line 40):**
    ```css
    /* 乙 MỘC — Bar zone (decouple khỏi Tú, dùng cho hóa giải hướng Nam + nhân sự Hỏa) */
    ```
    *Correction Needed:* Simplify the comment block to emphasize purely the feng shui balancing characteristics rather than referencing the name: `/* 乙 MỘC — Bar zone (Dùng cho hóa giải hướng Nam + nhân sự Hỏa) */`.

### 3.2 Design Prompt Assets
*   **`designs/pencil-bazi-adjustment-prompts.md`:**
    *   Lines 32, 37, 79, 89, 130, 146, 164, 167 contain direct strings referencing `"Pha chế Tú"`, `"Bar Tú"`, `"Mộc cho Tú"`, etc.
    *   *Correction Needed:* Clean these prompts to align strictly with natural container coffee theme principles.

### 3.3 Historical Reports
*   **`tools/bazi-mcp/report-nguyen-minh-tu.html`:**
    *   Contains the complete Bazi reading for Nguyễn Minh Tú. This is an audit tool asset and does not affect the active production UI, but should be noted as a legacy file.
*   **`reports/AURA_LOYALTY_TÚ.md` Verification:**
    *   *Result:* Verified to have been successfully decoupled and removed from active paths. No longer exists in `/reports` folder.

---

## 4. CSS Link Tag Verification

We have inspected the headers of all 14 active HTML templates in the workspace to verify if they correctly link to the global token source of truth `css/brand-tokens.css`.

### 4.1 Verification Matrix
| HTML File | Link Status | Path Type | Notes |
|---|---|---|---|
| `index.html` | ✅ Connected | `css/brand-tokens.css` | Both preloaded and imported |
| `about-us.html` | ✅ Connected | `css/brand-tokens.css` | Standard link |
| `brand-guideline.html`| ✅ Connected | `css/brand-tokens.css` | Standard link |
| `checkout.html` | ✅ Connected | `css/brand-tokens.css` | Standard link |
| `contact.html` | ✅ Connected | `css/brand-tokens.css` | Standard link |
| `dang-ky-thanh-vien.html`| ✅ Connected | `css/brand-tokens.css`| Standard link |
| `failure.html` | ✅ Connected | `css/brand-tokens.css` | Standard link |
| `menu.html` | ✅ Connected | `css/brand-tokens.css` | Standard link |
| `promotions.html` | ✅ Connected | `css/brand-tokens.css` | Standard link |
| `success.html` | ✅ Connected | `css/brand-tokens.css` | Standard link |
| `table-reservation.html`| ✅ Connected| `css/brand-tokens.css` | Standard link |
| `track-order.html` | ✅ Connected | `css/brand-tokens.css` | Standard link |
| `kds.html` | ✅ Connected | `/css/brand-tokens.css`| Scoped root link |
| `loyalty.html` | ✅ Connected | `css/brand-tokens.css` | Standard link |
| `receipt-template.html`| ⚠️ Excluded | `css/print-receipt.css`| Excluded appropriately; print-specific stylesheet |

---

## 5. Structured Actionable Recommendations

### 5.1 Element Color Cleanup (Fire/Earth Tones)
*   **Gradient Corrections (`data/loyalty-config.json`):**
    *   Bronze tier: Replace `linear-gradient(135deg, #CD7F32 0%, #8B4513 100%)` with a neutral Bazi-aligned gradient: `linear-gradient(135deg, #8A8A8A 0%, #4E525A 100%)` (Steel/Charcoal).
    *   Gold tier: Replace `linear-gradient(135deg, #FFD700 0%, #B8860B 100%)` with a Silver/Chrome gradient: `linear-gradient(135deg, #E8EEF3 0%, #A0A0A0 100%)` (Silver Sparkle).
*   **Menu/Promotions Orange Replacement (`menu.html`, `promotions.html`):**
    *   Map `--orange` variables directly to chrome bright or chrome mid variables:
        ```css
        --orange: var(--aura-chrome-mid); /* #6B9FB8 - Metal Chrome */
        ```
    *   Replace hardcoded color highlights (e.g. #FF6B35 in promotions.html:168) with `--aura-chrome-dark` (`#3A6B80`) or neutral muted grey elements.
*   **Error Page Red Gradient (`failure.html`):**
    *   Replace hardcoded `#FF1744` with neutral steel borders or Bazi-safe dark red `--aura-danger` (`#DC2626`).

### 5.2 Typography Standardization
*   **Hero Style Font Variable Alignment (`css/hero-aura.css`):**
    *   Lines 16 and 17 must inherit from the brand tokens directly:
        ```css
        --font-display: var(--aura-font-display);
        --font-body: var(--aura-font-body);
        ```
*   **Fallback Font Sanitization (`css/brand-tokens.css`):**
    *   Line 65 should remove `'Inter'` entirely:
        ```css
        --aura-font-body: 'Space Grotesk', system-ui, -apple-system, sans-serif;
        ```
*   **Admin Panels Integration:**
    *   Modify `admin/loyalty-dashboard.html` line 19 to use the correct v5.0 body typography:
        ```css
        body { font-family: var(--aura-font-body); }
        ```

### 5.3 Owner Context Decoupling
*   Edit line 40 of `css/brand-tokens.css` to remove the words "decouple khỏi Tú".
*   Perform string replacements across `designs/pencil-bazi-adjustment-prompts.md` to map "Tú" to "Admin" or "Chủ quán".
