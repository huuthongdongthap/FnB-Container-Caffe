# Implementation Plan: 100X Premium Hybrid Overhaul (Aura Cafe)

## Project Overview
This plan specifies the execution of the "100X Premium Hybrid Overhaul" for Aura Cafe. It incorporates a real-time hybrid theme mode, physically accurate brand storytelling, an interactive 5-zone showcase, and premium SVG social icons, all adhering strictly to the Bazi v5.1 guidelines (壬 Thủy Dương, supported by 庚/Xin Kim and 乙 Mộc; absolutely banning Fire/Hỏa & Earth/Thổ colors and unaligned fonts).

## Design & Color Tokens (Bazi v5.1 Hybrid)
- **Light Theme (Pearl-Silver & Jade):** Light, refreshing pearl background (#F4F7F6), silver/chrome accents (#C9D6DF, #6B9FB8), jade/mộc balancing accents (#4A7C59, #A8C5A0).
- **Dark Theme (Deep-Sea Navy & Chrome):** Dark premium navy background (#0A1A2E), ocean/abyss deep layers (#1A2A4E, #050D1A), chrome metallic accents (#E8EEF3, #C9D6DF, #6B9FB8), forest mộc zone accents (#1A2D1F, #2D5A3D).
- **Typography:** Headings: 'Cormorant Garamond' (serif); Body: 'Space Grotesk' (sans-serif); Tech/Prices: 'JetBrains Mono' (monospace).
- **Forbidden Colors:** Gold, Red, Orange, Brown (absolutely no occurrences).

## Overhaul Milestones

### Milestone 10: Codebase & Brand Audit for 100X Hybrid Overhaul
- **Objective:** Analyze `js/shared-nav.js`, all 11 HTML pages, and CSS styles to locate all placeholders, emoji links, layout requirements, and "view" text.
- **Verification:** Exploration handoff report detailing exact lines, files, and strategies for R1-R4 requirements.

### Milestone 11: Dynamic Real-time Hybrid Theme Mode
- **Objective:** Implement the real-time Sun Cycle theme engine in `js/shared-nav.js` and link it across all 11 HTML files. Ensure Pearl-Silver & Jade (Light) from 06:00 to 18:00, and Deep-Sea Navy & Chrome (Dark) from 18:00 to 06:00. Integrate the toggle button manually with persistent pause of auto-theme. Prevent FOVT (Flash of Unstyled Theme).
- **Verification:** Unit tests and browser console check showing correct `data-theme` application.

### Milestone 12: Physical Accuracy & Brand Story Rewrite
- **Objective:** Clean out 100% of fake "rice field" and "direct river view" keywords. Rewrite brand story in `index.html`, `about-us.html`, `contact.html`, `brand-guideline.html`, `promotions.html`, and metadata to reflect the real 2-story container rooftop layout on Hung Vuong street near Sa Dec river (grey steel frame, blue container, walnut furniture, navy/brown leather, plants, no direct river/field view).
- **Verification:** Text search results verifying zero "đồng lúa", "rice field", or "trực tiếp" river views.

### Milestone 13: Interactive 5-Zone Glassmorphic Showcase
- **Objective:** Replace `spaces-placeholder` in `index.html` with a stunning responsive glassmorphism grid covering 5 Zones: Mộc Zone Jade Counter, Rooftop Thủy Stage, Container Seating (Noir Cabin), Sunset Corner (Aura Lounge), and VIP Steel Nest. Apply high-fidelity backdrop-filter, thin borders, hover sweep light sweeps, and Bazi-aligned descriptions.
- **Verification:** HTML validation, layout responsiveness check, CSS styling check.

### Milestone 14: Premium SVG Social Icons Integration
- **Objective:** Remove all cheap emojis (📘, 📷, 🎵, 💬) from footer and drawer in `js/shared-nav.js`. Insert premium SVG icons for Facebook, Instagram, TikTok, and Zalo. Style with smooth hover Y-axis translate and silver-chrome color transitions.
- **Verification:** Clean code checks, correct SVG rendering, and smooth CSS transitions.

### Milestone 15: Final E2E Regression Verification & Forensic Audit
- **Objective:** Run the full E2E test suite (Jest tests) to verify 100% pass rate. Execute Forensic Auditor tool to perform thorough Bazi compliance scan and check for zero leaks.
- **Verification:** 100% test pass rate, green build, and clean Forensic Auditor report.
