# Bazi-aligned Aura Cafe UI Overhaul Analysis

## Core Findings Summary
This audit confirms that the active user-facing pages have successfully linked `css/brand-tokens.css` and migrated to Bazi v5.0 typography, but several instances of banned color elements (e.g., `#FFD700`, `#D4AF37`, `#B8860B`, `#FF6B35`, `#FF1744`), banned typography (`Playfair Display`, `Inter` as fallback), and owner context (`Nguyễn Minh Tú` / `Tú`) still persist in layout code, config files, admin modules, and comments.

---

## 1. Banned Color Elements Audit
The Bazi v5.0 specification mandates removing all Earth (Gold/Brown) and Fire (Red/Orange) elements to align with the owner's Water (壬 Thủy) energy, replacing them with Chrome/Silver (Kim ✓) accents.

### Active Files with Forbidden Colors
| Color Hex | Category | File Path | Line | Context / Snippet | Action Needed |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`#FFD700`** | Gold / Earth | `admin/launch-monitor.html` | 83 | `border: 1px solid #FFD700;` | Replace with `--aura-chrome-light` (`#C9D6DF`) |
| | | `brand-guideline.html` | 514 | `* • REVERT: Gold Metallic (#D4AF37, #FFD700, #B8860B)...` | (Comment) No action needed, but clean if desired |
| | | `css/brand-tokens.css` | 16 | `* • REVERT: Gold Metallic (#D4AF37, #FFD700, #B8860B)...` | (Comment) Keep as history or clean |
| **`#D4AF37`** | Gold / Earth | `admin/loyalty-dashboard.html` | 14 | `color: #D4AF37;` | Replace with `--aura-chrome-light` (`#C9D6DF`) |
| | | `admin/loyalty-dashboard.html` | 255 | `borderColor: '#D4AF37'` | Replace with `--aura-chrome-light` (`#C9D6DF`) |
| | | `brand-guideline.html` | 514 | `* • REVERT: Gold Metallic (#D4AF37, #FFD700, #B8860B)...` | (Comment) No action needed |
| | | `css/brand-tokens.css` | 16 | `* • REVERT: Gold Metallic (#D4AF37, #FFD700, #B8860B)...` | (Comment) Keep as history |
| **`#B8860B`** | Gold / Earth | `data/loyalty-config.json` | 53 | `"card_background_color": "#B8860B"` | Replace with `--aura-chrome-dark` (`#3A6B80`) |
| | | `designs/leaflet-a5.html` | 447 | `background: linear-gradient(135deg, #FFD700, #B8860B);` | Replace with `--aura-grad-chrome` |
| | | `brand-guideline.html` | 514 | `* • REVERT: Gold Metallic (#D4AF37, #FFD700, #B8860B)...` | (Comment) No action needed |
| | | `css/brand-tokens.css` | 16 | `* • REVERT: Gold Metallic (#D4AF37, #FFD700, #B8860B)...` | (Comment) Keep as history |
| **`#FFE970`** | Gold / Earth | *None* | - | *No occurrences found in active code.* | Clear |
| **`#FF6B35`** | Red / Fire | `admin/dashboard.html` | 15 | `--orange:#FF6B35;` | Replace with Bazi-correct neutral or Kim token |
| | | `admin/dashboard.html` | 230 | `stroke="#FF6B35"` | Replace with Chrome/Silver token |
| | | `admin/dashboard.html` | 237 | `background:#FF6B35` | Replace with Chrome/Silver token |
| | | `admin/reservations.html` | 14 | `--orange:#FF6B35;` | Replace with Bazi-correct neutral or Kim token |
| | | `menu.html` | 16 | `--orange:#FF6B35;` | Replace with Bazi-correct neutral or Kim token |
| | | `promotions.html` | 168 | `background-color: #FF6B35;` | Replace with Bazi-correct neutral or Kim token |
| **`#FF1744`** | Red / Fire | `failure.html` | 247 | `stroke: #FF1744;` | Replace with neutral/danger token |
| | | `failure.html` | 267 | `background-color: #FF1744;` | Replace with neutral/danger token |
| **`#8B4513`** | Earthy Brown | `data/loyalty-config.json` | 14 | `"tier_badge_color": "#8B4513"` | Replace with Bazi-correct neutral or Kim token |
| **`#C9A200`** | Earthy Brown | *None* | - | *No occurrences found in active code.* | Clear |
| **`#C9A962`** | Earthy Brown | *None* | - | *No occurrences found in active code.* | Clear |

---

## 2. Banned Typography Audit
Bazi-aligned typography mandates using **Cormorant Garamond** (for display/headings) and **Space Grotesk** (for body/labels). The fonts `Playfair Display`, `Cinzel`, `Manrope`, and `Inter` are strictly prohibited.

### Typography Findings
1. **`Playfair Display`:**
   - **`css/hero-aura.css` (line 16):** `--font-display: 'Playfair Display', serif;` is hardcoded. This must be replaced with `var(--aura-font-display)`.
   - **`css/brand-tokens.css` (line 18):** Mentioned in comment block: `* • Font:   Playfair Display → Cormorant Garamond`. (No action needed).
2. **`Cinzel`:**
   - **No occurrences** found in active root HTML/CSS/JS files. (Only present in legacy `_deploy` files and comments). Excellent compliance!
3. **`Manrope`:**
   - **No occurrences** found in active root HTML/CSS/JS files. (Only present in legacy `_deploy` files, comments, and `.pen` files). Excellent compliance!
4. **`Inter`:**
   - **`css/brand-tokens.css` (line 65):** `--aura-font-body: 'Space Grotesk', 'Inter', system-ui, -apple-system, sans-serif;` references `Inter` as a secondary fallback.
   - **`css/hero-aura.css` (line 17):** `--font-body: 'Inter', sans-serif;` is hardcoded. This must be replaced with `var(--aura-font-body)`.
   - **`admin/dashboard.html` (line 18):** `--fb: 'Inter', -apple-system, sans-serif;` is hardcoded. This should be updated to Space Grotesk.

---

## 3. Nguyễn Minh Tú / Tú Decoupling Audit
To decouple the context of the previous partner (Nguyễn Minh Tú) and re-position the **Mộc Zone** as a natural feng shui balance (Wood dissolving Fire in the South direction), we must clean up the following references.

### References Found
1. **`css/brand-tokens.css` (line 40):**
   - `/* 乙 MỘC — Bar zone (decouple khỏi Tú, dùng cho hóa giải hướng Nam + nhân sự Hỏa) */`
   - *Recommendation:* Clean the comment to read: `/* 乙 MỘC — Bar zone (Hóa giải hướng Nam + nhân sự Hỏa) */`
2. **`designs/pencil-bazi-adjustment-prompts.md`:**
   - Multiple references inside canvas prompts: `"Pha chế Tú"`, `"Bar Tú"`, `"rút năng lượng Tú"`, `"Tú sáng tạo"`, `"Mộc cho Tú"`.
   - *Recommendation:* Since these are design prompt notes, keep them for reference but ensure no subsequent UI designs or metadata expose them.
3. **`tools/bazi-mcp/report-nguyen-minh-tu.html`:**
   - The entire report analyzes Nguyễn Minh Tú.
   - *Recommendation:* Retain as archive only; do not import or build this report in the active bundle.

---

## 4. CSS Link Verification (`css/brand-tokens.css`)
Every active HTML page must link `css/brand-tokens.css` as the single source of truth for all style tokens.

| Page Name | `brand-tokens.css` Linked? | Line # | Specific `href` value used | Status |
| :--- | :---: | :---: | :--- | :--- |
| `about-us.html` | **Yes** | 34 | `css/brand-tokens.css` | ✅ Validated |
| `brand-guideline.html` | **Yes** | 10 | `css/brand-tokens.css` | ✅ Validated |
| `checkout.html` | **Yes** | 10 | `css/brand-tokens.css` | ✅ Validated |
| `contact.html` | **Yes** | 10 | `css/brand-tokens.css` | ✅ Validated |
| `dang-ky-thanh-vien.html`| **Yes** | 11 | `css/brand-tokens.css` | ✅ Validated |
| `failure.html` | **Yes** | 77 | `css/brand-tokens.css` | ✅ Validated |
| `index.html` | **Yes** | 16, 22 | `css/brand-tokens.css` | ✅ Validated |
| `kds.html` | **Yes** | 11 | `/css/brand-tokens.css` | ✅ Validated (uses leading slash) |
| `loyalty.html` | **Yes** | 13 | `css/brand-tokens.css` | ✅ Validated |
| `menu.html` | **Yes** | 10 | `css/brand-tokens.css` | ✅ Validated |
| `promotions.html` | **Yes** | 12 | `css/brand-tokens.css` | ✅ Validated |
| `success.html` | **Yes** | 77 | `css/brand-tokens.css` | ✅ Validated |
| `table-reservation.html` | **Yes** | 10 | `css/brand-tokens.css` | ✅ Validated |
| `track-order.html` | **Yes** | 64 | `css/brand-tokens.css` | ✅ Validated |

---

## Actionable Recommendations for Implementation Plan
1. **Color Replacement Patch:** Apply a comprehensive replacement of all hardcoded forbidden hex codes (Gold/Earth, Red/Orange/Fire, Earthy Browns) in `admin/launch-monitor.html`, `admin/loyalty-dashboard.html`, `menu.html`, `promotions.html`, `failure.html`, `data/loyalty-config.json`, and `designs/leaflet-a5.html` with corresponding Bazi v5.0 variables or neutral tokens.
2. **Typography Alignment:** Replace `'Playfair Display'` in `css/hero-aura.css` with `var(--aura-font-display)`. Replace hardcoded `'Inter'` references with `var(--aura-font-body)`.
3. **Decouple Comments:** Edit `css/brand-tokens.css` line 40 to remove the reference to "Tú".
4. **Consistency check for `kds.html`:** The `href` for `brand-tokens.css` in `kds.html` uses `/css/brand-tokens.css` (leading slash). While correct for absolute routing, standardizing it to `css/brand-tokens.css` matching all other pages will simplify local offline testing/file systems without needing a local web server root.
