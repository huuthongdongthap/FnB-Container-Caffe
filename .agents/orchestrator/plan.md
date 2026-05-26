# Implementation Plan: Bazi-aligned Aura Cafe UI Overhaul

## Project Overview
This project focuses on auditing, upgrading, and synchronizing the UI/UX across all 11 HTML pages of the Aura Cafe system. It strictly enforces the Bazi requirements of owner Nguyen Huu Con (Nhật chủ 壬 Thủy Dương, supported by 庚/辛 Kim and 乙 Mộc; absolutely banning Fire/Hỏa & Earth/Thổ colors and unaligned fonts).

## Architecture & Design Language (Brand v5.0)
- **Primary (壬 Thủy):** Dark luxury tones: Navy/Ocean/Abyss (#0A1A2E, #1A2A4E, #050D1A).
- **Accent (庚/辛 Kim):** Metallic tones: Chrome/Silver (#E8EEF3, #C9D6DF, #6B9FB8, #3A6B80).
- **Zoning (乙 Mộc):** Nature/Bar equilibrium tones: Forest/Jade/Morning Dew (#1A2D1F, #2D5A3D, #4A7C59, #A8C5A0).
- **Banned Colors:** Gold/Earth tones (#FFD700, #D4AF37, #B8860B, #FFE970), Red/Orange/Fire tones (#FF6B35, #FF1744), Earthy Browns (#8B4513, #C9A200, #C9A962).
- **Banned Fonts:** Playfair Display, Cinzel, Manrope, Inter.
- **Allowed Fonts:** Heading: 'Cormorant Garamond' (serif); Body: 'Space Grotesk' (sans-serif); Tech/Prices: 'JetBrains Mono' (monospace).

## Milestones

### Milestone 1: UI Audit & Setup
- **Objective:** Establish the audit baseline by searching all 11 HTML files, CSS sheets, and JS files for forbidden colors, disallowed fonts, and references to Minh Tu.
- **Verification:** An audit log file detailing every line and file that violates Bazi specifications.

### Milestone 2: Brand CSS & Tokens (v5.0 Alignment)
- **Objective:** Update `css/brand-tokens.css` to be 100% compliant. Ensure there are no hex codes, descriptions, or variables referencing banned colors or fonts. Apply proper typography and zoning tokens. Update `brand-guideline.html` with the correct Bazi-aligned brand story and story of Mộc Zone as a natural balancing solution.
- **Verification:** Unit tests and automated compliance script output confirming zero banned items.

### Milestone 3: Premium UI & Subtle Glassmorphism Overhaul
- **Objective:** Enhance the design of `index.html`, `menu.html`, `checkout.html`, `loyalty.html`, and `table-reservation.html` to adopt premium styling. Add subtle glassmorphism layers, perfect borders, mobile responsiveness, and micro-interactions. Ensure Minh Tu references are fully decoupled.
- **Verification:** Reviewer checks of layout responsiveness and aesthetic appeal.

### Milestone 4: Water Ripple Hero Animation v8 Bazi Chrome
- **Objective:** Upgrade the Water Ripple animation on `index.html` hero section to use a sleek Chrome-Silver gradient, fluid ripples with light blue cool undertone, specular sweeps, and zero gold glow.
- **Verification:** Visual checks and performance analysis (aiming for 60fps on mobile).

### Milestone 5: E2E Validation & Integrity Check
- **Objective:** Run E2E test suites, fix outstanding bugs, perform automated validation, and verify all 11 HTML pages load properly without errors.
- **Verification:** Green tests, clean Forensic Auditor verdict, and complete compatibility.

### Milestone 6: Bazi v5.1 FOUT & Layout Shift Optimization
- **Objective:** Preload Google Fonts (*Cormorant Garamond*, *Space Grotesk*, *JetBrains Mono*) and configure `font-display: swap` across all 11+ HTML pages.
- **Verification:** Simulated Slow 3G page loading metrics and Lighthouse visual diagnostics.

### Milestone 7: Bazi v5.1 Brand Guideline Uniformity
- **Objective:** Eliminate "Gold" references and descriptive labels in `brand-guideline.html` and align all textual descriptions with the metallic Chrome/Silver Bazi tokens.
- **Verification:** Complete textual search ensuring zero occurrences of "Gold" adjacent to silver hex codes.

### Milestone 8: Bazi v5.1 Admin Dashboard Leak Cleanup
- **Objective:** Clean up color leaks in the admin dashboard page (`admin/launch-monitor.html` and other admin pages), shifting all status badges, layouts, and charts to compliant Bazi v5.1 tones (Navy, Chrome-Silver, Mộc Zone).
- **Verification:** Code audit and visual inspection.

### Milestone 9: Final E2E & Integrity Verification
- **Objective:** Final end-to-end regression testing, ensuring all pages and admin portals load with zero console errors and 100% compliance with Bazi v5.1 aesthetics.
- **Verification:** 100% PASS in Jest test suite and CLEAN Forensic Auditor check.
