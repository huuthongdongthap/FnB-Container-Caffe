# Project: Bazi-aligned Aura Cafe UI Overhaul

## Architecture
The system consists of 11 premium static/Vite HTML pages linked with a modular styling architecture:
- **`css/brand-tokens.css`:** Version 5.0 of color system (壬 Thủy, 庚/辛 Kim, 乙 Mộc) and Typography tokens.
- **HTML Pages:** `index.html`, `menu.html`, `checkout.html`, `success.html`, `failure.html`, `loyalty.html`, `track-order.html`, `kds.html`, `table-reservation.html`, `about-us.html`, `contact.html`, `brand-guideline.html`.
- **Dynamic CSS:** Sub-page stylesheets under `css/` that reference global brand tokens.
- **Water Ripple Animation:** Hero-section script integrated into `index.html` referencing brand-tokens.css.

## Milestones
| # | Name | Scope | Dependencies | Status | Conversation ID |
|---|---|---|---|---|---|
| 1 | UI Audit & Setup | Search and locate all forbidden color codes, fonts, and references to Minh Tu | none | DONE | 5358b50d-2667-4042-8ae2-a44409bbc564, c43840b3-511a-4911-961b-07facefcbd34 |
| 2 | Brand CSS & Tokens | Align css/brand-tokens.css and brand-guideline.html to Bazi v5.0 | M1 | DONE | 32a7e613-2daa-4154-b819-9b14a7552900 |
| 3 | Premium UI Overhaul | Upgrade index, menu, checkout, loyalty, table-reservation layouts to subtle glassmorphism | M2 | DONE | 32a7e613-2daa-4154-b819-9b14a7552900 |
| 4 | Water Ripple Animation | Revamp Hero section ripple on index.html to Chrome-Silver gradient | M3 | DONE | 32a7e613-2daa-4154-b819-9b14a7552900 |
| 5 | E2E Validation & Audit | End-to-end user experience verification and Forensic Integrity Check | M4 | DONE | 2f397835-2078-4dc9-89f2-1ee6b6c6c775, 9a1bfc3b-3f07-4acb-a64f-ae08914091d2 |
| 6 | FOUT & Layout Shift | Preload fonts & add font-display: swap on all 11+ HTML pages | none | DONE | |
| 7 | Brand Guideline Uniformity | Replace "Gold" text/labels with "Chrome/Silver" in brand-guideline.html | none | DONE | |
| 8 | Admin Dashboard Color | Clean up color leak in admin/ files to align with Bazi v5.1 | none | DONE | |
| 9 | Final E2E & Integrity | Verify all features and run Forensic Audit for Bazi v5.1 compliance | M6,M7,M8 | DONE | |

## Summary

**All 9 milestones complete. Project fully operational.**

| Metric | Value |
|--------|-------|
| ESLint errors | 0 (58 warnings, non-blocking) |
| Vite build | ✓ 458ms |
| Jest tests | 544/544 passed (14 suites) |
| Bazi v5.1 compliance | ✓ Navy/Chrome/Mộc only — zero Fire/Earth leaks in core pages |
| Font system | Cormorant Garamond + Space Grotesk + JetBrains Mono, font-display: swap |
| Theme | Real-time auto-switch (light 06:00-18:00, dark otherwise) + manual toggle |
| Icons | Premium SVG (no emoji in footer/drawer) |
| 5-Zone showcase | Jade Counter / Sky Deck / Noir Cabin / Aura Lounge / VIP Steel Nest |
| Cache-busting | Versioned assets (?v=2.2.1) |
| Accessibility | aura-sr-only inline styles, WCAG AA contrast verified |
### Global Stylesheets ↔ HTML Layouts
- Every page must load `css/brand-tokens.css` first.
- Font styling must rely strictly on `--aura-font-display`, `--aura-font-body`, and `--aura-font-mono`.
- Forbidden color codes must never be hardcoded; only Bazi-aligned tokens are allowed.
