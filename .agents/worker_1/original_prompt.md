## 2026-05-26T06:05:00Z
Implement the changes for Milestone 2 (Brand CSS & Tokens alignment), Milestone 3 (Premium UI & Glassmorphism Overhaul), and Milestone 4 (Water Ripple Animation).

### Precise Implementation Requirements

#### Part 1: Bazi Color and Typography Cleanup (Milestone 2)
1. **`css/brand-tokens.css`**:
   - Line 65: Purge `'Inter'` fallback from `--aura-font-body` (use `'Space Grotesk', system-ui, -apple-system, sans-serif;`).
   - Line 40: Remove the name "Tú" from the comment, changing it to: `/* 乙 MỘC — Bar zone (Hóa giải hướng Nam + nhân sự Hỏa) */`.
2. **`css/hero-aura.css`**:
   - Replace `--font-display: 'Playfair Display', serif;` with `var(--aura-font-display)`.
   - Replace `--font-body: 'Inter', sans-serif;` with `var(--aura-font-body)`.
   - Re-route banned variables (`--color-gold-bright`, `--color-gold-mid`, `--color-gold-dark`, `--color-gold-glow`) to Bazi-correct silver/chrome tokens:
     - `--color-gold-bright: var(--aura-silver-bright, #e8eef3);`
     - `--color-gold-mid: var(--aura-silver-primary, #c9d6df);`
     - `--color-gold-dark: var(--aura-silver-cool, #3a6b80);`
     - `--color-gold-glow: var(--aura-glow-chrome);`
   - Re-route `--color-red-banned: #FF1744;` and `--color-orange-banned: #FF6B35;` to neutral/danger or chrome tokens, or remove their active usage in warnings.
3. **`css/print-receipt.css`**:
   - Shift color tokens from Earth (Brown) to Metal/Water:
     - `--coffee-primary: #1A1F35; /* Steel Noir */`
     - `--coffee-secondary: #2C3145; /* Mist Slate */`
     - `--coffee-accent: #C0C0C0; /* Metallic Silver */`
     - `--coffee-light: #F5F5F5; /* Crisp Silver-White */`
     - `--coffee-dark: #0A0F1F; /* Void Noir */`
4. **`brand-guideline.html`**:
   - Correct typography description on line 640 to represent `Space Grotesk` rather than `Inter`.
5. **`loyalty-calculator.html`**:
   - Link `css/brand-tokens.css` in the `<head>`.
   - Replace hardcoded `--primary: #d4af37` with `var(--aura-silver-primary)` (silver).
   - Replace `--font-body: 'Inter'` and `--font-display: 'Outfit'` with Bazi-approved variables: `var(--aura-font-body)` for body, `var(--aura-font-display)` for display.
   - Update inline radial gradients and shadows from gold RGB to silver/steel RGB.
6. **`hero-demo.html`**:
   - Link `css/brand-tokens.css`.
   - Replace light gold SVG stop colors (`#FFE680` etc) with chrome-silver gradients.
7. **Active Pages Color Migrations**:
   - Locate and systematically replace hardcoded forbidden hex codes (Gold/Earth, Red/Orange/Fire, Earthy Browns) with Chrome/Silver or neutral tokens in:
     - `admin/launch-monitor.html` (e.g. line 83: `#FFD700` → `var(--aura-chrome-light)`)
     - `admin/loyalty-dashboard.html` (e.g. `#D4AF37` → `var(--aura-chrome-light)`)
     - `admin/dashboard.html` (e.g. `#FF6B35` → `var(--aura-chrome-mid)`, `Inter` → `var(--aura-font-body)`)
     - `admin/reservations.html` (e.g. `#FF6B35` → `var(--aura-chrome-mid)`)
     - `menu.html` (e.g. `#FF6B35` → `var(--aura-chrome-mid)`)
     - `promotions.html` (e.g. `#FF6B35` → `var(--aura-chrome-mid)`)
     - `failure.html` (e.g. `#FF1744` → `var(--aura-danger)`)
     - `data/loyalty-config.json` (e.g. `"card_background_color": "#B8860B"` → `"#3A6B80"` or steel-blue; `"tier_badge_color": "#8B4513"` → silver/chrome)
     - `designs/leaflet-a5.html` (e.g. replace gold linear-gradient `#FFD700` & `#B8860B` with `--aura-grad-chrome`)
8. **Decouple Minh Tú**:
   - Rename `reports/AURA_LOYALTY_TÚ.md` to `reports/AURA_LOYALTY_SYSTEM.md`.
   - Scan and edit its contents to replace any occurrences of "Tú" or "Minh Tú" with neutral roles (e.g., "Chủ quán", "AURA Admin", "Nguyễn Hữu Còn").
9. **`kds.html`**:
   - Standardize `brand-tokens.css` link `href` from `/css/brand-tokens.css` to `css/brand-tokens.css` for system consistency.

#### Part 2: Premium UI & Subtle Glassmorphism Overhaul (Milestone 3)
In the main active files: `index.html`, `menu.html`, `checkout.html`, `loyalty.html`, and `table-reservation.html`:
- Apply subtle glassmorphism classes/styles: `backdrop-filter: blur(12px) saturate(180%); background: rgba(10, 26, 46, 0.65); border: 1px solid rgba(201, 214, 223, 0.12);`.
- Ensure padding, borders, and margins are pristine and highly responsive on mobile.
- Enhance hover scales and adding micro-interactions to buttons and cards.

#### Part 3: Water Ripple Hero Animation v8 Bazi Chrome (Milestone 4)
In `index.html` (or referenced JS scripts for the hero ripple):
- Search and refactor the Water Ripple script to fully transition the visual canvas/hues from Gold to Chrome-Silver gradient (`#E8EEF3` -> `#C9D6DF` -> `#6B9FB8`).
- Set smooth, fine ripples with a cool blue undertone.
- Ensure logo has specular sweep and a subtle, high-end glow effect.
